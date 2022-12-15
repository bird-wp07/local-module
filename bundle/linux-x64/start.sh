#!/usr/bin/env bash

set -e

# ######################
# ADMINISTRATOR SETTINGS
# ######################
LOCAL_MODULE_PORT=2048
DSS_PORT=8089

# Constants
# ---------

# Path of the standalone node root directory extracted from the archive.
# Contains, among other files, the 'node.exe' and 'npm' executables.
node_root_path="node-v18.12.1-linux-x64"
node_bin_path="$node_root_path/bin"

node_url="https://nodejs.org/dist/v18.12.1/node-v18.12.1-linux-x64.tar.xz"
node_archive_filename="node-standalone-v18.12.1-linux-x64.tar.xz"

java_root_path="jdk-19.0.1"
java_url="https://download.oracle.com/java/19/latest/jdk-19_linux-x64_bin.tar.gz"
java_archive_filename="jdk-19_linux-x64_bin.tar.gz"

p7zip_root_path="7z"
p7zip_bin_path="$p7zip_root_path"
p7zip_url="https://www.7-zip.org/a/7z2201-linux-x64.tar.xz"
p7zip_archive_filename="7z2201-linux-x64.tar.xz"

# Path of the dss root directory extracted from the archive. Contains, among
# other files, the 'Webapp-Startup.bat' and 'Webapp-Shutdown.bat' batch files.
dss_root_path="dss-demo-bundle-5.11.1"

dss_url="https://ec.europa.eu/digital-building-blocks/artifact/repository/esignaturedss/eu/europa/ec/joinup/sd-dss/dss-demo-bundle/5.11.1/dss-demo-bundle-5.11.1.zip"
dss_archive_filename="dss-standalone-v5.11.1.zip"

# Path of the local module installed via
#
#     npm i --prefix <PREFIX> @bird-wp07/local-module
#
# Contains 'package.json', 'package-lock.json' and 'node_modules/.'
local_module_root_path="./local-module"

# Path of the apache server's configuration file.
server_config_path="$dss_root_path/apache-tomcat-8.5.82/conf/server.xml"

# Configure logging. Depending on whether we're running inside a terminal use
# colors or don't.
if [ -t 1 ]; then
	__log() {
		prefix="$1"
		code="$2"
		shift 2
		printf -- "$*\n" | sed 's/^/[start.sh] '"$(printf "$code")""$prefix""$(printf "\033[0m")"': /'
	}
else
	__log() {
		prefix="$1"
		shift 2
		printf -- "$*\n" | sed 's/^/[start.sh] '"$prefix"': /'
	}
fi
log.info() { __log "info" "\033[32;1m" "$*"; }
log.err() { __log "err " "\033[31;1m" "$*"; }

install_dependencies() {
    # TODO: Remove dependency on xz for standalone bundle
    for prog in curl gzip xz; do
        if ! command -v $prog >/dev/null; then
            log.err "Cannot find required '$prog' binary." >&2
            return 1
        fi
    done
    
    what="${1:-all}"
    if [ "$what" = "7zip" ] || [ "$what" = "all" ]; then
        if [ -d "$p7zip_bin_path" ]; then
            log.info "7zip binary path found at '$p7zip_bin_path'."
        else
            log.info "7zip binary path not found at '$p7zip_bin_path'. Starting download ..."
            curl -Lo "$p7zip_archive_filename" "$p7zip_url"
            mkdir -p "$p7zip_bin_path"
            tar -C "$p7zip_bin_path" -xvf "$p7zip_archive_filename"
        fi
    fi
    
    if [ "$what" = "node" ] || [ "$what" = "all" ]; then
        if [ -d "$node_bin_path" ]; then
            log.info "Standalone nodejs distribution found at '$node_bin_path'."
        else
            log.info "Standalone nodejs distribution not found at '$node_bin_path'. Starting download ..."
            curl -Lo "$node_archive_filename" "$node_url"
            tar -xvf "$node_archive_filename"
        fi
    fi
    
    if [ "$what" = "dss" ] || [ "$what" = "all" ]; then
        if [ -d "$dss_root_path" ]; then
            log.info "DSS installation found at '$dss_root_path'."
        else
            log.info "DSS installation not found at '$dss_root_path'. Starting download ..."
            curl -Lo "$dss_archive_filename" "$dss_url"
            PATH="$p7zip_bin_path:$PATH" 7zz x "$dss_archive_filename" # the portable 7z's binary is named '7zz', not '7z' (???)
            chmod +x "$dss_root_path/apache-tomcat-8.5.82/bin/catalina.sh"
        fi
    fi
    
    if [ "$what" = "java" ] || [ "$what" = "all" ]; then
        if [ -d "$java_root_path" ]; then
            log.info "Java installation found at '$java_root_path'."
        else
            log.info "Java installation not found at '$java_root_path'. Starting download ..."
            curl -Lo "$java_archive_filename" "$java_url"
            tar -xvzf "$java_archive_filename"
        fi
    fi
    
    if [ "$what" = "local-module" ] || [ "$what" = "all" ]; then
        if [ -d "$local_module_root_path" ]; then
            log.info "Local module installation found at '$local_module_root_path'."
        else
            log.info "Local module installation not found at '$local_module_root_path'. Starting download ..."
            PATH="$node_bin_path:$PATH" npm install --prefix "$local_module_root_path" "@bird-wp07/local-module"
        fi
    fi
}

# Builds self-contained tar.xz archive. Used by pipelines.
build_standalone_bundle() {
    archive_filename="${1:-archive.tar.xz}"
    install_dependencies
    rm -rf "$dss_root_path/java" # remove embedded java for windows
    
    touch README ./postman.json # HACK: interop with github pipelines
    tar -cvJf "$archive_filename" "$java_root_path" "$node_root_path" "$p7zip_root_path" "$local_module_root_path" "README" "start.sh" "./postman.json"
    log.info "Built standalone archive '$archive_filename'."
}

start_dss() {
    # HACK: Replace the server's default port by in-file substitution.
    #       Unfortunately, there is no easier method as we're not in control of
    #       the server's configuration.
    sed -i -E 's|(<Connector port=")([^"]+)(" protocol="HTTP/1.1")|\1'"$DSS_PORT"'\3|g' "$server_config_path"
    
    JRE_HOME="$java_root_path"
    CATALINA_HOME="$dss_root_path/apache-tomcat-8.5.82"
    JRE_HOME="$JRE_HOME" CATALINA_HOME="$CATALINA_HOME" "$dss_root_path/apache-tomcat-8.5.82/bin/catalina.sh" run
}

# Lists dss and local-module processes in 'pgrep -af <COMMANDLINE>' syntax.
# Useful for debugging.
ls_proc() {
    what="${1:-all}"
    if [ "$what" = "dss" ] || [ "$what" = "all" ]; then
        pgrep -af -- "-Djava.util.logging.config.file=./dss-demo-bundle-5.11.1/apache-tomcat-8.5.82"
    fi
    
    if [ "$what" = "local-module" ] || [ "$what" = "all" ]; then
        pgrep -af node | grep -E '^[[:digit:]]+ node .*/local-module'
    fi
    return 0
}

# Match all DSS processes by their commandlines and terminate them.
stop_dss() {
    ls_proc dss | cut -d' ' -f1 | while read pid; do
        log.info "killing DSS process '$pid'"
        kill $pid >/dev/null 2>&1
    done
}

main() {
    install_dependencies
    export PATH="$PWD/$node_bin_path:$PATH"
    export WP07_LOCAL_MODULE_PORT=$LOCAL_MODULE_PORT
    export WP07_DSS_BASE_URL="http://127.0.0.1:$DSS_PORT"
    start_dss >/dev/null 2>&1 &
    cd "$local_module_root_path"
    npx "@bird-wp07/local-module"
}

if [ "$1" = "--nocd" ]; then
    shift
else
    # Switch to script's directory for consistent execution.
    cd "$(dirname "$(realpath "$0")")"
fi

if [ -z "$1" ]; then
    main
else
    "$@"
fi
