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
nodeBinPath="node-v18.12.1-linux-x64/bin"

nodeUrl="https://nodejs.org/dist/v18.12.1/node-v18.12.1-linux-x64.tar.xz"
nodeTarFileName="node-standalone-v18.12.1-linux-x64.tar.xz"

javaRootPath="jdk-19.0.1"
javaUrl="https://download.oracle.com/java/19/latest/jdk-19_linux-x64_bin.tar.gz"
javaTarFileName="jdk-19_linux-x64_bin.tar.gz"

p7zipBinPath="7z"
p7zipUrl="https://www.7-zip.org/a/7z2201-linux-x64.tar.xz"
p7zipTarFileName="7z2201-linux-x64.tar.xz"

# Path of the dss root directory extracted from the archive. Contains, among
# other files, the 'Webapp-Startup.bat' and 'Webapp-Shutdown.bat' batch files.
dssRootPath="dss-demo-bundle-5.11.1"

dssUrl="https://ec.europa.eu/digital-building-blocks/artifact/repository/esignaturedss/eu/europa/ec/joinup/sd-dss/dss-demo-bundle/5.11.1/dss-demo-bundle-5.11.1.zip"
dssZipFileName="dss-standalone-v5.11.1.zip"

# Path of the local module installed via
#
#     npm i --prefix <PREFIX> @bird-wp07/local-module
#
# Contains 'package.json', 'package-lock.json' and 'node_modules/.'
localModulePath="./local-module"

# Path of the apache server's configuration file.
serverConfigPath="$dssRootPath/apache-tomcat-8.5.82/conf/server.xml"

log() {
	printf -- "$@\n" | sed 's/^/[start.sh] /'
}

install_dependencies() {
    # TODO: Remove dependency on xz for standalone bundle
    for prog in curl xz; do
        if ! command -v $prog >/dev/null; then
            log "Cannot find required '$prog' binary." >&2
            return 1
        fi
    done
    
    what="${1:-all}"
    if [ "$what" = "7zip" ] || [ "$what" = "all" ]; then
        if [ -d "$p7zipBinPath" ]; then
            log "7zip binary path found at '$p7zipBinPath'."
        else
            log "7zip binary path not found at '$p7zipBinPath'. Starting download ..."
            curl -Lo "$p7zipTarFileName" "$p7zipUrl"
            mkdir -p "$p7zipBinPath"
            tar -C "$p7zipBinPath" -xvf "$p7zipTarFileName"
        fi
    fi
    
    if [ "$what" = "node" ] || [ "$what" = "all" ]; then
        if [ -d "$nodeBinPath" ]; then
            log "Standalone nodejs distribution found at '$nodeBinPath'."
        else
            log "Standalone nodejs distribution not found at '$nodeBinPath'. Starting download ..."
            curl -Lo "$nodeTarFileName" "$nodeUrl"
            tar -xvf "$nodeTarFileName"
        fi
    fi
    
    if [ "$what" = "dss" ] || [ "$what" = "all" ]; then
        if [ -d "$dssRootPath" ]; then
            log "DSS installation found at '$dssRootPath'."
        else
            log "DSS installation not found at '$dssRootPath'. Starting download ..."
            curl -Lo "$dssZipFileName" "$dssUrl"
            PATH="$p7zipBinPath:$PATH" 7zz x "$dssZipFileName" # the portable 7z's binary is named '7zz', not '7z' (???)
            chmod +x "$dssRootPath/apache-tomcat-8.5.82/bin/catalina.sh"
        fi
    fi
    
    if [ "$what" = "java" ] || [ "$what" = "all" ]; then
        if [ -d "$javaRootPath" ]; then
            log "Java installation found at '$javaRootPath'."
        else
            log "Java installation not found at '$javaRootPath'. Starting download ..."
            curl -Lo "$javaTarFileName" "$javaUrl"
            tar -xvzf "$javaTarFileName"
        fi
    fi
    
    if [ "$what" = "local-module" ] || [ "$what" = "all" ]; then
        if [ -d "$localModulePath" ]; then
            log "Local module installation found at '$localModulePath'."
        else
            log "Local module installation not found at '$localModulePath'. Starting download ..."
            PATH="$nodeBinPath:$PATH" npm install --prefix "$localModulePath" "@bird-wp07/local-module"
        fi
    fi
}

start_dss() {
    # HACK: Replace the server's default port by in-file substitution.
    #       Unfortunately, there is no easier method as we're not in control of
    #       the server's configuration.
    sed -i -E 's|(<Connector port=")([^"]+)(" protocol="HTTP/1.1")|\1'"$DSS_PORT"'\3|g' "$serverConfigPath"
    
    JRE_HOME="$javaRootPath"
    CATALINA_HOME="$dssRootPath/apache-tomcat-8.5.82"
    JRE_HOME="$JRE_HOME" CATALINA_HOME="$CATALINA_HOME" "$dssRootPath/apache-tomcat-8.5.82/bin/catalina.sh" run
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
        log "killing DSS process '$pid'"
        kill $pid >/dev/null 2>&1
    done
}

main() {
    install_dependencies
    export PATH="$PWD/$nodeBinPath:$PATH"
    export WP07_LOCAL_MODULE_PORT=$LOCAL_MODULE_PORT
    export WP07_DSS_BASE_URL="http://127.0.0.1:$DSS_PORT"
    start_dss >/dev/null 2>&1 &
    cd "$localModulePath"
    npx "@bird-wp07/local-module"
}

if [ "$1" = "--nocd" ]; then
    shift
else
    # Switch to script's directory for consistend execution.
    cd "$(dirname "$(realpath "$0")")"
fi

if [ -z "$1" ]; then
    main
else
    "$@"
fi
