# ######################
# ADMINISTRATOR SETTINGS
# ######################
$LOCAL_MODULE_PORT = 2048
$DSS_PORT = 8080

# Constants
$nodeBinPath = ".\node-v18.12.1-win-x64"
$dssRootDir = ".\dss-demo-bundle-5.11.1"
$serverConfigPath = "$dssRootDir\apache-tomcat-8.5.82\conf\server.xml"

# Change into the directory containing this script for constistent execution
# irrspective of the working directory from where this script is run.
$rootDir = Split-Path $MyInvocation.MyCommand.Path
Set-Location $rootDir

function Start-DSS {
    # HACK: Replace the server's default port by in-file substitution.
    #       Unfortunately, there is no easier method as we're not in control of
    #       the server's configuration.
    $content = Get-Content $serverConfigPath
    $lineNr = ($content | Select-String "<!-- ====").LineNumber # pwsh's indexing is off-by-one -_-
    $buffer = $content[$lineNr] -replace 'port="[^"]*"', "port=`"$DSS_PORT`""
    $content[$lineNr] = $buffer
    Set-Content $serverConfigPath $content

    # Run the included startup batch file from its own directory.
    Push-Location $dssRootDir
    Start-Process -FilePath cmd.exe -ArgumentList "/c", ".\Webapp-Startup.bat"
    Pop-Location
}

# Kill running DSS servers by eliminating processes whose commandlines match
# our use case. This is a hack to solve the problem of the included shutdown
# batch file not working properly unless the dss server has fully finished its
# boot sequence.
function Stop-DSS {
    $query = ( "Select * from win32_Process where " +
        "(ExecutablePath like '%dss-demo-bundle-5.11.1\\java\\bin\\java.exe') and " +
        "(CommandLine like '%org.apache.catalina.startup.Bootstrap%')" )
    $results = Get-WmiObject -Query $query
    foreach ($result in $results) {
        Stop-Process $result.handle
    }
}

function main {
    # Prepend the nodejs binary abspath to PATH to guarantee that our installed
    # nodejs is used.
    $nodeBin = Resolve-Path $nodeBinPath
    $env:Path = "$($nodeBin);$($env:Path)"

    try {
        # Start DSS in the background in a separate cmd.exe window.
        Start-DSS

        # Start the local module's http server.
        $env:WP07_LOCAL_MODULE_PORT = $LOCAL_MODULE_PORT
        $env:WP07_DSS_BASE_URL = "http://127.0.0.1:$DSS_PORT"
        npx "@bird-wp07/local-module"
    }
    finally {
        # Finally ensures cleanup even if the script was ungracefully killed
        Stop-DSS
    }
}

Switch ($args[0]) {
    stop-dss { Stop-DSS }
    start-dss { Start-DSS }
    default { main }
}