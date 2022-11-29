# ######################
# ADMINISTRATOR SETTINGS
# ######################
$LOCAL_MODULE_PORT = 2048
$DSS_BASE_URL = "http://localhost:8080"

# Constants
$nodeBinPath = ".\node-v18.12.1-win-x64"

# Change into the directory containing this script for constistent execution
# irrspective from the current working directory.
$scriptpath = $MyInvocation.MyCommand.Path
$rootDir = Split-Path $scriptpath
cd $rootDir

# Prepend the nodejs binary abspath to PATH to guarantee that our installed
# nodejs is used.
$nodeBin = Resolve-Path $nodeBinPath
$env:Path = "$($nodeBin);$($env:Path)"

# Start the local module's http server.
Push-Location $localModulePath
$env:WP07_LOCAL_MODULE_PORT = $LOCAL_MODULE_PORT
$env:WP07_DSS_BASE_URL = $DSS_BASE_URL
npx "@bird-wp07/local-module"