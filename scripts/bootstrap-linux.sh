#!/usr/bin/env bash
# Bootstrap DSS and local module, downloading all dependencies for linux
# machines. We use bash instead of zsh as this script is deployed to
# institutional IT systems. This self-contained script is exported as the
# 'start.sh' in the linux bundles.

set -e

# ######################
# ADMINISTRATOR SETTINGS
# ######################
LOCAL_MODULE_PORT=${LOCAL_MODULE_PORT:-2048}
DSS_PORT=${DSS_PORT:-8089}

# Default installation path names.
# --------------------------------
JDK_ROOT="${JDK_ROOT:-jdk}"
DSS_ROOT="${DSS_ROOT:-dss}"
NODE_ROOT="${NODE_ROOT:-node}"
LM_ROOT="${LM_ROOT:-local-module}"
DSS_PID_FILE=".dss.pid"

# Configure logging. Depending on whether we're running inside a terminal use
# colors or don't.
if [ -t 1 ]; then
    __log() {
        prefix="$1"
        code="$2"
        shift 2
        printf -- "$*\n" | sed 's/^/[start.sh] '"$(printf "$code")""$prefix""$(printf "\x1b[0m")"': /'
    }
else
    __log() {
        prefix="$1"
        shift 2
        printf -- "$*\n" | sed 's/^/[start.sh] '"$prefix"': /'
    }
fi
log.info() { __log "info" "\x1b[32;1m" "$*"; }
log.err() { __log "err " "\x1b[31;1m" "$*"; }

# Installs java into $1.
install_jdk() {
    [ -z "$1" ] && { log.err "missing JDK output directory path"; return 1; }
    [ -d "$1" ] && { log.info "JDK found at '$1'. Skipping install."; return; }
    log.info "Installing JDK at '$1'."

    # The archive contents' paths are prefixed with 'jdk-<VERSION>'. We remove
    # this prefix while unpacking for consistent naming of the JDK root
    # directory, independent of the JDK version we're using.
    mkdir -p "$1"
    curl -Lso - "https://download.oracle.com/java/19/archive/jdk-19.0.1_linux-x64_bin.tar.gz" |
        tar -xvzf - --strip-components 1 -C "$1"
}

# Installs DSS into $1.
install_dss() {
    [ -z "$1" ] && { log.err "missing DSS output directory path"; return 1; }
    [ -d "$1" ] && { log.info "DSS found at '$1'. Skipping install."; return; }
    log.info "Installing DSS at '$1'."

    mkdir -p "$1"
    curl -Ls "https://api.github.com/repos/bird-wp07/dss-demonstrations/releases/latest" |
        jq -r '.assets[] | select(.browser_download_url | endswith("tar.gz")).browser_download_url' |
        xargs -n1 curl -Lso - |
        tar -xvzf - --strip-components 1 -C "$1"
    rm -r "$1/java" # delete windows jre
}

# Installs standalone node into $1. $PATH is not modified.
install_node() {
    [ -z "$1" ] && { log.err "missing Node output directory path"; return 1; }
    [ -d "$1" ] && { log.info "Node found at '$1'. Skipping install."; return; }
    log.info "Installing Node at '$1'."

    mkdir -p "$1"
    curl -Lso - "https://nodejs.org/dist/v18.12.1/node-v18.12.1-linux-x64.tar.xz" |
        tar -xvJf - --strip-components 1 -C "$1"
}

# Installs local module into $1. $2 chooses a tag to install, defaulting to the latest release.
install_lm() {
    for dep in node npm npx; do
        command -v "$dep" >/dev/null || { log.err "$dep not found"; return 1; }
    done
    [ -z "$1" ] && { log.err "missing local module output directory path"; return 1; }
    [ -d "$1" ] && { log.info "Local module found at '$1'. Skipping install."; return; }
    log.info "Installing local module at '$1'."

    mkdir -p "$1"
    [ ! -z $2 ] && urlsuffix="tags/$2" || urlsuffix="latest"
    curl -Ls "https://api.github.com/repos/bird-wp07/local-module/releases/$urlsuffix" |
        jq -r ".tarball_url" |
        xargs -n1 curl -Lso - |
        tar -xvzf - --strip-components 1 -C "$1"

    cd "$1"
    npm install
    npm run build
    cd -
}

# Builds self-contained tar.xz archive. Used by pipelines.
build_standalone_bundle() {
    archive_filename="${1:-archive.tar.xz}"
    lmver="$(cat VERSION)"
    install_dependencies all $lmver
    rm -rf "$dss_root_path/java" # remove embedded java for windows

    touch ./postman.json README.html # HACK: interop with github pipelines
    tar -cJf "$archive_filename" "$JDK_ROOT" "$NODE_ROOT" "$p7zip_root_path" "$dss_root_path" "$local_module_root_path" "start.sh" "./postman.json" "VERSION" "./README.html"
    log.info "Built standalone archive '$archive_filename'."
}

# Installs all dependencies, using default output directories. $1 can be used
# to specify the local module's version tag.
bootstrap() {
    install_jdk "$JDK_ROOT"
    install_dss "$DSS_ROOT"
    install_node "$NODE_ROOT"
    PATH="NODE_ROOT/bin:$PATH" install_lm "$LM_ROOT" "$1"
}

# Starts local module, using default directories and settings. The process runs
# in the foreground.
start_lm() {
    # Use a subshell so our cwd doesn't get messed up. Makes cleanup via traps
    # easier as we can use the relative default paths.
    (
        cd "$LM_ROOT"
        WP07_DSS_BASEURL="http://127.0.0.1:$DSS_PORT" \
            WP07_LOCAL_MODULE_BASEURL="http://127.0.0.1:$LOCAL_MODULE_PORT" \
            PATH="$NODE_ROOT/bin:$PATH" npm run start
    )
}

# Starts DSS webapp, using default directories and settings. By default, the
# process runs in the foreground. $1 can be used to specify a pid file, in
# which case the process is run in the background and the pid is written to the
# file.
start_dss() {
    [ -z "$JAVA_HOME" ] && ! command -v java >/dev/null && { log.err "java not found and \$JAVA_HOME undefined"; return 1; }

    # HACK: Replace the server's default port by in-file substitution.
    #       Unfortunately, there is no easier method as we're not in control of
    #       the server's configuration.
    cfg_xml="$DSS_ROOT/apache-tomcat-8.5.82/conf/server.xml"
    sed -i -E 's|(<Connector port=")([^"]+)(" protocol="HTTP/1.1")|\1'"$DSS_PORT"'\3|g' "$cfg_xml"

    if [ -z "$1" ]; then
        bash "$DSS_ROOT/apache-tomcat-8.5.82/bin/catalina.sh" run
    else
        bash "$DSS_ROOT/apache-tomcat-8.5.82/bin/catalina.sh" run &
        echo $! >"$1"
    fi
}

# Kills the DSS process reading the pid from $1. If $1 is not provided, the
# default pid file path is used.
stop_dss() {
    [ -z "$1" ] && pidfile="$DSS_PID_FILE" || pidfile="$1";
    [ ! -f "$pidfile" ] && { log.err "no pid file at '$pidfile'"; return 1; }
    kill "$(cat "$pidfile")"
    rm -rf "$pidfile"
}

# One-click start-all function for users of the linux bundle.
serve_all() {
    # The linux bundle contains a VERSION file to ensure that older version of
    # the local module can be built. To be able to use this script locally, we
    # allow running it without a VERSION file, which will default to the latest
    # local module version tag.
    tag="$(cat VERSION 2>/dev/null)" || tag=""
    bootstrap "$tag"

    # Ensure cleanup of DSS process
    trap "stop_dss" EXIT
    
    # Start DSS in the background and fire up the local module.
    JAVA_HOME="$JRE_ROOT" start_dss "$DSS_PID_FILE" >/dev/null 2>&1
    start_lm
}

if [ -z "$1" ]; then
    cd "$(dirname "$(realpath "$0")")"
    serve_all
else
    "$@"
fi
