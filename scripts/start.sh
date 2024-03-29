#!/usr/bin/env bash

# Bootstraps DSS and local module, downloading all dependencies for x64
# linux. We use bash instead of zsh as this script is deployed to
# institutional IT systems. This self-contained script is exported as the
# 'start.sh' in the linux bundles and is used to build the dev docker image.
# There is no reason to run this script manually during development.

# ######################
# ADMINISTRATOR SETTINGS
# ######################
LOCAL_MODULE_BASEURL="http://127.0.0.1:2048"
LOCAL_MODULE_LOGDIR=.
DSS_BASEURL="http://127.0.0.1:8089"
CS_BASEURL="http://46.83.201.35.bc.googleusercontent.com"
CS_TOKEN_URL="https://225.96.234.35.bc.googleusercontent.com/realms/bird-cs-dev/protocol/openid-connect/token"
CS_CA_PEM="cs-auth-mtls-server-cert.pem"
CS_CLIENT_PFX="cs-auth-mtls-client-certkey.p12"
CS_CLIENT_PFX_PASSWORD=
PROXY_HOST=
PROXY_PORT=
PROXY_USER=
PROXY_PASSWORD=

set -e

# Default installation path names
JDK_ROOT="${JDK_ROOT:-jdk}"
DSS_ROOT="${DSS_ROOT:-dss}"
NODE_ROOT="${NODE_ROOT:-node}"
LM_ROOT="${LM_ROOT:-local-module}"

# Runtime parameters derived from administrator settings, if not already set
# via the environment
WP07_LOCAL_MODULE_BASEURL="${WP07_LOCAL_MODULE_BASEURL:-"$LOCAL_MODULE_BASEURL"}"
if [ -z "$WP07_LOCAL_MODULE_LOGDIR" ]; then
    if [ ! -z $LOCAL_MODULE_LOGDIR ]; then
        WP07_LOCAL_MODULE_LOGDIR="$(realpath "$LOCAL_MODULE_LOGDIR")"
    fi
fi
WP07_DSS_BASEURL="${WP07_DSS_BASEURL:-"$DSS_BASEURL"}"
WP07_CS_BASEURL="${WP07_CS_BASEURL:-"$CS_BASEURL"}"
WP07_CS_TOKEN_URL="${WP07_CS_TOKEN_URL:-"$CS_TOKEN_URL"}"
if [ -z "$WP07_CS_CA_PEM" ] && [ ! -z "$CS_CA_PEM" ]; then
    WP07_CS_CA_PEM="$(realpath "$CS_CA_PEM")"
fi
if [ -z "$WP07_CS_CLIENT_PFX" ] && [ ! -z "$CS_CLIENT_PFX" ]; then
    WP07_CS_CLIENT_PFX="$(realpath "$CS_CLIENT_PFX")"
fi
WP07_CS_CLIENT_PFX_PASSWORD="${WP07_CS_CLIENT_PFX_PASSWORD:-"$CS_CLIENT_PFX_PASSWORD"}"
WP07_PROXY_HOST="$PROXY_HOST"
WP07_PROXY_PORT="$PROXY_PORT"
WP07_PROXY_USER="$PROXY_USER"
WP07_PROXY_PASSWORD="$PROXY_PASSWORD"
DSS_PID_FILE=".dss.pid"

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

    curl -Lso dss.zip "https://ec.europa.eu/digital-building-blocks/artifact/repository/esignaturedss/eu/europa/ec/joinup/sd-dss/dss-demo-bundle/5.11.1/dss-demo-bundle-5.11.1.zip"

    # The archive contains a top-level dir 'dss-demo-bundle-5.11.1', which we
    # manually strip by renaming it, akin to tar's --strip-components.
    7z x dss.zip
    mv "dss-demo-bundle-5.11.1" "$1"
}

# Configures proxy settings for outgoing DSS HTTP(S) connections (downloading
# LOTLs etc.). May be passed
#   - four arguments: proxy host, proxy port, basicauth user, basicauth password
#   - two arguments:  proxy host, proxy port
#   - no arguments:   disables usage of a proxy
dss_configure_proxy() {
    proxy_host="$1"
    proxy_port="$2"
    proxy_basicauth_user="$3"
    proxy_basicauth_password="$4"

    cfg_path="$DSS_ROOT/apache-tomcat-8.5.82/lib/dss-custom.properties"

    if [ $# -eq 0 ]; then
        cat >"$cfg_path" <<<"proxy.http.enabled = false
proxy.https.enabled = false
"
    elif [ $# -ge 2 ]; then
        cat >"$cfg_path" <<<"proxy.http.enabled = true
proxy.http.host = $proxy_host
proxy.http.port = $proxy_port
proxy.https.enabled = true
proxy.https.host = $proxy_host
proxy.https.port = $proxy_port
"
        if [ $# -eq 4 ]; then
        cat >>"$cfg_path" <<<"proxy.http.user = $proxy_basicauth_user
proxy.http.password = $proxy_basicauth_password
proxy.https.user = $proxy_basicauth_user
proxy.https.password = $proxy_basicauth_password
"
        fi
    fi
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
        WP07_LOCAL_MODULE_BASEURL="$WP07_LOCAL_MODULE_BASEURL" \
            WP07_LOCAL_MODULE_LOGDIR="$WP07_LOCAL_MODULE_LOGDIR" \
            WP07_DSS_BASEURL="$WP07_DSS_BASEURL" \
            WP07_CS_BASEURL="$WP07_CS_BASEURL" \
            WP07_CS_TOKEN_URL="$WP07_CS_TOKEN_URL" \
            WP07_CS_CA_PEM="$WP07_CS_CA_PEM" \
            WP07_CS_CLIENT_PFX="$WP07_CS_CLIENT_PFX" \
            WP07_CS_CLIENT_PFX_PASSWORD="$WP07_CS_CLIENT_PFX_PASSWORD" \
            WP07_PROXY_HOST="$WP07_PROXY_HOST" \
            WP07_PROXY_PORT="$WP07_PROXY_PORT" \
            WP07_PROXY_USER="$WP07_PROXY_USER" \
            WP07_PROXY_PASSWORD="$WP07_PROXY_PASSWORD" \
            PATH="$(realpath "$NODE_ROOT")/bin:$PATH" \
            npm run start"$nobuild"
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
    dss_port="$(printf -- "$WP07_DSS_BASEURL" | cut -d: -f3-)"
    sed -i -E 's|(<Connector port=")([^"]+)(" protocol="HTTP/1.1")|\1'"$dss_port"'\3|g' "$cfg_xml"

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
    # Assert existence of required utils.
    for dep in curl xz jq tar 7z sed; do
        if ! command -v "$dep" >/dev/null 2>&1; then
            log_err "Required program '$dep' is not installed. Abort."
            exit 1
        fi
    done
    # The linux bundle contains a VERSION file to ensure that older version of
    # the local module can be built. To be able to use this script locally, we
    # allow running it without a VERSION file, which will default to the latest
    # local module version tag.
    tag="$(cat VERSION 2>/dev/null)" || tag=""
    install_all "$tag"

    # Ensure cleanup of DSS process.
    trap "stop_dss" EXIT

    # Configure DSS proxy settings and launch it in the background.
    dss_configure_proxy "$PROXY_HOST" "$PROXY_PORT" "$PROXY_USER" "$PROXY_PASSWORD"
    JAVA_HOME="$(realpath "$JDK_ROOT")" start_dss "$DSS_PID_FILE" >/dev/null

    # Start LM.
    PATH="$(realpath "$NODE_ROOT")/bin:$PATH" \
        start_lm
}

if [ -z "$1" ]; then
    cd "$(dirname "$0")"
    serve_all
else
    "$@"
fi
