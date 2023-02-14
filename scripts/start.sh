#!/usr/bin/env bash
# Bootstrap DSS and local module, downloading all dependencies for x64 linux.
# We use bash instead of zsh as this script is deployed to institutional IT
# systems. This self-contained script is exported as the 'start.sh' in the
# linux bundles.

set -e

# ######################
# ADMINISTRATOR SETTINGS
# ######################
WP07_DSS_BASEURL="${WP07_DSS_BASEURL:-"http://127.0.0.1:8089"}"
WP07_LOCAL_MODULE_BASEURL="${WP07_LOCAL_MODULE_BASEURL:-"http://127.0.0.1:2048"}"

# Default installation path names
# -------------------------------
JDK_ROOT="${JDK_ROOT:-jdk}"
DSS_ROOT="${DSS_ROOT:-dss}"
NODE_ROOT="${NODE_ROOT:-node}"
LM_ROOT="${LM_ROOT:-local-module}"

# Miscellaneous parameters
# ------------------------
DSS_PID_FILE=".dss.pid"
DSS_PORT="$(printf -- "$WP07_DSS_BASEURL" | cut -d: -f3-)"

# Configure logging. Depending on whether we're running inside a terminal use
# colors or don't.
if [ -t 1 ]; then
    __log() {
        a="$1"; b="$2"; c="$3"; shift 3;
        printf -- "$*\n" | sed "s/^/[$a] $c$b\x1b[0m: /"
    }
else
    __log() {
        a="$1"; b="$2"; c="$3"; shift 3;
        printf -- "$*\n" | sed "s/^/[$a] $c: /"
    }
fi
prefix="start.sh" # beware: must escape sed-relevant characters
log_info() { __log "$prefix" "info" "\x1b[32;1m" "$@"; }
log_err() { __log "$prefix" "err " "\x1b[31;1m" "$@"; }

# Installs java into $1.
install_jdk() {
    [ -z "$1" ] && { log_err "missing JDK output directory path"; return 1; }
    [ -d "$1" ] && { log_info "JDK found at '$1'. Skipping install."; return; }
    log_info "Installing JDK at '$1'."
    
    # The archive contents' paths are prefixed with 'jdk-<VERSION>'. We remove
    # this prefix while unpacking for consistent naming of the JDK root
    # directory, independent of the JDK version we're using.
    mkdir -p "$1"
    curl -Lso - "https://download.oracle.com/java/19/archive/jdk-19.0.1_linux-x64_bin.tar.gz" |
    tar -xvzf - --strip-components 1 -C "$1"
}

# Installs DSS into $1.
install_dss() {
    [ -z "$1" ] && { log_err "missing DSS output directory path"; return 1; }
    [ -d "$1" ] && { log_info "DSS found at '$1'. Skipping install."; return; }
    log_info "Installing DSS at '$1'."
    
    mkdir -p "$1"
    curl -Ls "https://api.github.com/repos/bird-wp07/dss-demonstrations/releases/latest" |
    jq -r '.assets[] | select(.browser_download_url | endswith("tar.gz")).browser_download_url' |
    xargs -n1 curl -Lso - |
    tar -xvzf - --strip-components 1 -C "$1"
}

# Installs standalone node into $1. $PATH is not modified.
install_node() {
    [ -z "$1" ] && { log_err "missing Node output directory path"; return 1; }
    [ -d "$1" ] && { log_info "Node found at '$1'. Skipping install."; return; }
    log_info "Installing Node at '$1'."
    
    mkdir -p "$1"
    curl -Lso - "https://nodejs.org/dist/v18.12.1/node-v18.12.1-linux-x64.tar.xz" |
    tar -xvJf - --strip-components 1 -C "$1"
}

# Installs local module into $1. $2 chooses a tag to install, defaulting to the latest release.
install_lm() {
    for dep in node npm npx; do
        command -v "$dep" >/dev/null || { log_err "$dep not found"; return 1; }
    done
    [ -z "$1" ] && { log_err "missing local module output directory path"; return 1; }
    [ -d "$1" ] && { log_info "Local module found at '$1'. Skipping install."; return; }
    log_info "Installing local module at '$1'."
    
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

# Installs all dependencies, using default output directories. $1 can be used
# to specify the local module's version tag.
install_all() {
    install_jdk "$JDK_ROOT"
    install_dss "$DSS_ROOT"
    install_node "$NODE_ROOT"
    PATH="$(realpath "$NODE_ROOT")/bin:$PATH" install_lm "$LM_ROOT" "$1"
}

# Starts local module, using default directories and settings. The process runs
# in the foreground. The compilation step is skipped if node_modules exists.
start_lm() {
    # Use a subshell so our cwd doesn't get messed up. Makes cleanup via traps
    # easier as we can use the relative default paths.
    (
        cd "$LM_ROOT"
        [ -d "./node_modules" ] && nobuild=":nobuild"
        PATH="$(realpath "$NODE_ROOT")/bin:$PATH" npm run start"$nobuild"
    )
}

# Starts DSS webapp, using default directories and settings. By default, the
# process runs in the foreground. $1 can be used to specify a pid file, in
# which case the process is run in the background and the pid is written to the
# file.
start_dss() {
    [ -z "$JAVA_HOME" ] && ! command -v java >/dev/null && { log_err "java not found and \$JAVA_HOME undefined"; return 1; }
    
    # HACK: Replace the server's default port by in-file substitution.
    #       Unfortunately, there is no easier method as we're not in control of
    #       the server's configuration.
    cfg_xml="$DSS_ROOT/apache-tomcat-8.5.82/conf/server.xml"
    sed -i -E 's|(<Connector port=")([^"]+)(" protocol="HTTP/1.1")|\1'"$DSS_PORT"'\3|g' "$cfg_xml"
    
    if [ -z "$1" ]; then
        bash "$DSS_ROOT/apache-tomcat-8.5.82/bin/catalina.sh" run 2>&1
    else
        bash "$DSS_ROOT/apache-tomcat-8.5.82/bin/catalina.sh" run 2>&1 &
        echo $! >"$1"
    fi
}

# Kills the DSS process reading the pid from $1. If $1 is not provided, the
# default pid file path is used.
stop_dss() {
    [ -z "$1" ] && pidfile="$DSS_PID_FILE" || pidfile="$1";
    [ ! -f "$pidfile" ] && { log_err "no pid file at '$pidfile'"; return 1; }
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
    install_all "$tag"
    
    # Ensure cleanup of DSS process.
    trap "stop_dss" EXIT
    
    # Start DSS in the background and fire up the local module.
    JAVA_HOME="$(realpath "$JDK_ROOT")" start_dss "$DSS_PID_FILE" >/dev/null
    PATH="$(realpath "$NODE_ROOT")/bin:$PATH" start_lm
}

if [ -z "$1" ]; then
    cd "$(dirname "$0")"
    serve_all
else
    "$@"
fi
