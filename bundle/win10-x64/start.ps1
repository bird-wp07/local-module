# ######################
# ADMINISTRATOR SETTINGS
# ######################
$LOCAL_MODULE_PORT = 2048
$DSS_PORT = 8089
$DEBUG = 1

# Constants
# ---------

# Path of the standalone node root directory extracted from the archive.
# Contains, among other files, the 'node.exe' and 'npm.exe' executables.
$nodeBinPath = ".\node-v18.12.1-win-x64"

# Path of the dss root directory extracted from the archive. Contains, among
# other files, the 'node.exe' and 'npm.exe' executables.
$dssRootPath = ".\dss-demo-bundle-5.11.1"

# Path of the local module installed via
#
#     npm i --prefix <PREFIX> @bird-wp07/local-module
#
# Contains 'package.json', 'package-lock.json' and 'node_modules/.'
$localModulePath = ".\local-module"

# Path of the apache server's configuration file.
$serverConfigPath = "$dssRootPath\apache-tomcat-8.5.82\conf\server.xml"

# Downloads
$nodeUrl = "https://nodejs.org/dist/v18.12.1/node-v18.12.1-win-x64.zip"
$nodeZipFileName = ".\node-standalone-v18.12.1-win-x64.zip"
$dssUrl = "https://ec.europa.eu/digital-building-blocks/artifact/repository/esignaturedss/eu/europa/ec/joinup/sd-dss/dss-demo-bundle/5.11.1/dss-demo-bundle-5.11.1.zip"
$dssZipFileName = ".\dss-standalone-v5.11.1.zip"

# Control the [x] button of the Powershell window, in order to guarantee cleanup. See
#
#     https://stackoverflow.com/questions/73746912
function Set-XButton {
    #Calling user32.dll methods for Windows and Menus
    $MethodsCall = '
    [DllImport("user32.dll")] public static extern long GetSystemMenu(IntPtr hWnd, bool bRevert);
    [DllImport("user32.dll")] public static extern bool EnableMenuItem(long hMenuItem, long wIDEnableItem, long wEnable);
    [DllImport("user32.dll")] public static extern long SetWindowLongPtr(long hWnd, long nIndex, long dwNewLong);
    [DllImport("user32.dll")] public static extern bool EnableWindow(long hWnd, int bEnable);
    '

    $SC_CLOSE = 0xF060
    $MF_DISABLED = 0x00000002L
    $MF_ENABLED = 0x00000000L

    #Create a new namespace for the Methods to be able to call them
    Add-Type -MemberDefinition $MethodsCall -name NativeMethods -namespace Win32

    $PSWindow = Get-Process -Pid $PID
    $hwnd = $PSWindow.MainWindowHandle

    #Get System menu of windows handled
    $hMenu = [Win32.NativeMethods]::GetSystemMenu($hwnd, 0)

    if ($args[0] -eq "0") {
        $state = $MF_DISABLED
    }
    else {
        $state = $MF_ENABLED
    }
    [Win32.NativeMethods]::EnableMenuItem($hMenu, $SC_CLOSE, $state) | Out-Null
}

function Start-DSS {
    # HACK: Replace the server's default port by in-file substitution.
    #       Unfortunately, there is no easier method as we're not in control of
    #       the server's configuration.
    [xml]$cfg = Get-Content $serverConfigPath
    $cfg.Server.Service.Connector.port = "$DSS_PORT"
    $cfg.Save((Resolve-Path $serverConfigPath))

    # Run the included startup batch file from its own directory. Depdending on
    # the debug setting, show or hide the dss cmd.exe window.
    Push-Location $dssRootPath
    $env:JRE_HOME = ".\java"
    $env:CATALINA_HOME = ".\apache-tomcat-8.5.82"
    if ($DEBUG -eq 1) {
        Start-Process -FilePath cmd.exe -ArgumentList "/c", ".\apache-tomcat-8.5.82\bin\catalina.bat run"
    }
    else {
        Start-Process -FilePath cmd.exe -ArgumentList "/c", ".\apache-tomcat-8.5.82\bin\catalina.bat run" `
            -RedirectStandardError "NUL" -RedirectStandardOut "..\NUL" -NoNewWindow
        #                           ^^^~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^~~~~~~~~~~~~~~ lol, windows
        # See https://stackoverflow.com/questions/49375418
    }
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

# If needed, downloads missing dependencies (dss, standalone node, local
# module). Whether a dependency needs to be downloaded is asserted from the
# existence of the respective directory (dss, local module and node root
# directory).
#
# The contents of a directory, if it exists, are not further inspected. In
# order to issue a full re-download of a component delete its directory.
function Install-Dependencies ($what) {
    if (($what -eq "node") -or ($what -eq "all")) {
        if (Test-Path -Path $nodeBinPath) {
            Write-Host "Standalone nodejs distribution found at '$nodeBinPath'."
        }
        else {
            Write-Host "Standalone nodejs distribution not found at '$nodeBinPath'. Starting download ..."
            Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeZipFileName
            Write-Host "Extracting archive ..."
            Expand-Archive -Path $nodeZipFileName -DestinationPath .
        }
    }

    if (($what -eq "dss") -or ($what -eq "all")) {
        if (Test-Path -Path $dssRootPath) {
            Write-Host "DSS installation found at '$dssRootPath'."
        }
        else {
            Write-Host "Dss installation not found at '$dssRootPath'. Starting download ..."
            Invoke-WebRequest -Uri $dssUrl -OutFile $dssZipFileName
            Write-Host "Extracting archive ..."
            Expand-Archive -Path $dssZipFileName -DestinationPath .
        }
    }

    if (($what -eq "local-module") -or ($what -eq "all")) {
        if (Test-Path -Path $localModulePath) {
            Write-Host "Local module installation found at '$localModulePath'."
        }
        else {
            Write-Host "Local module installation not found at '$localModulePath'. Starting download ..."
            # We're using the full path, as the node root hasn't been exported to PATH.
            Start-Process -FilePath "$nodeBinPath\npm" -ArgumentList "install", "--prefix", $localModulePath, "@bird-wp07/local-module" -Wait
        }
    }
}

function main {
    Set-XButton 0

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
        Push-Location $localModulePath
        npx "@bird-wp07/local-module"
        Pop-Location
    }
    finally {
        # Finally ensures cleanup even if the script was killed via ctrl-c.
        Stop-DSS

        # Reactive [x] button and return to original directory.
        Set-XButton 1
        Set-Location $rootDir
    }
}

# Change into the directory containing this script for constistent execution
# irrspective of the working directory from where this script is run.
$rootDir = Split-Path $MyInvocation.MyCommand.Path
Set-Location $rootDir

Switch ($args[0]) {
    stop-dss { Stop-DSS }
    start-dss { Start-DSS }
    install-dependencies { Install-Dependencies $args[1]}
    default { main }
}