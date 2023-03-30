# Change into the directory containing this script for constistent execution
# irrspective of the working directory from where this script is run.

# scriptDir holds the abspath of the script's or .exe's directory, irrespective
# of whether we're using a powershell script or an .exe compiled via PS2EXE.
$scriptDir = if (-not $PSScriptRoot) { Split-Path -Parent (Convert-Path ([environment]::GetCommandLineArgs()[0])) } else { $PSScriptRoot }
Set-Location $scriptDir
Write-Host "Starting script at '$scriptDir'."

# If not defined via the environment, set baseurls from config file.
if ($null -eq $env:WP07_LOCAL_MODULE_BASEURL) {
    $env:WP07_LOCAL_MODULE_BASEURL = Get-Content "$scriptDir\CONFIG" | Select-String "^LOCAL_MODULE_BASEURL=(.*)$" | ForEach-Object{$_.Matches[0].Groups[1].Value}
}
if ($null -eq $env:WP07_LOCAL_MODULE_LOGDIR) {
    $val = Get-Content "$scriptDir\CONFIG" | Select-String "^LOCAL_MODULE_LOGDIR=(.*)$" | ForEach-Object{$_.Matches[0].Groups[1].Value}
    if ($val) {
        # TODO: Reuse $val here and below.
        $env:WP07_LOCAL_MODULE_LOGDIR = Get-Content "$scriptDir\CONFIG" | Select-String "^LOCAL_MODULE_LOGDIR=(.*)$" | ForEach-Object{$_.Matches[0].Groups[1].Value} | Resolve-Path
    }
}
if ($null -eq $env:WP07_DSS_BASEURL) {
    $env:WP07_DSS_BASEURL = Get-Content "$scriptDir\CONFIG" | Select-String "^DSS_BASEURL=(.*)$" | ForEach-Object{$_.Matches[0].Groups[1].Value}
}
if ($null -eq $env:WP07_CS_BASEURL) {
    $env:WP07_CS_BASEURL = Get-Content "$scriptDir\CONFIG" | Select-String "^CS_BASEURL=(.*)$" | ForEach-Object{$_.Matches[0].Groups[1].Value}
}
if ($null -eq $env:WP07_CS_TOKEN_URL) {
    $val = Get-Content "$scriptDir\CONFIG" | Select-String "^CS_TOKEN_URL=(.*)$" | ForEach-Object{$_.Matches[0].Groups[1].Value}
    if ($val) {
        $env:WP07_CS_TOKEN_URL = Get-Content "$scriptDir\CONFIG" | Select-String "^CS_TOKEN_URL=(.*)$" | ForEach-Object{$_.Matches[0].Groups[1].Value}
    }
}
if ($null -eq $env:WP07_CS_CA_PEM) {
    $val = Get-Content "$scriptDir\CONFIG" | Select-String "^CS_CA_PEM=(.*)$" | ForEach-Object{$_.Matches[0].Groups[1].Value}
    if ($val) {
        $env:WP07_CS_CA_PEM = Get-Content "$scriptDir\CONFIG" | Select-String "^CS_CA_PEM=(.*)$" | ForEach-Object{$_.Matches[0].Groups[1].Value} | Resolve-Path
    }
}
if ($null -eq $env:WP07_CS_CLIENT_PFX) {
    $val = Get-Content "$scriptDir\CONFIG" | Select-String "^CS_CLIENT_PFX=(.*)$" | ForEach-Object{$_.Matches[0].Groups[1].Value}
    if ($val) {
        $env:WP07_CS_CLIENT_PFX = Get-Content "$scriptDir\CONFIG" | Select-String "^CS_CLIENT_PFX=(.*)$" | ForEach-Object{$_.Matches[0].Groups[1].Value} | Resolve-Path
    }
}
if ($null -eq $env:WP07_CS_CLIENT_PFX_PASSWORD) {
    $val = Get-Content "$scriptDir\CONFIG" | Select-String "^CS_CLIENT_PFX_PASSWORD=(.*)$" | ForEach-Object{$_.Matches[0].Groups[1].Value}
    if ($val) {
        $env:WP07_CS_CLIENT_PFX_PASSWORD = Get-Content "$scriptDir\CONFIG" | Select-String "^CS_CLIENT_PFX_PASSWORD=(.*)$" | ForEach-Object{$_.Matches[0].Groups[1].Value}
    }
}
if ($null -eq $env:WP07_PROXY_HOST) {
    $val = Get-Content "$scriptDir\CONFIG" | Select-String "^PROXY_HOST=(.*)$" | ForEach-Object{$_.Matches[0].Groups[1].Value}
    if ($val) {
        $env:WP07_PROXY_HOST = Get-Content "$scriptDir\CONFIG" | Select-String "^PROXY_HOST=(.*)$" | ForEach-Object{$_.Matches[0].Groups[1].Value}
    }
}
if ($null -eq $env:WP07_PROXY_PORT) {
    $val = Get-Content "$scriptDir\CONFIG" | Select-String "^PROXY_PORT=(.*)$" | ForEach-Object{$_.Matches[0].Groups[1].Value}
    if ($val) {
        $env:WP07_PROXY_PORT = Get-Content "$scriptDir\CONFIG" | Select-String "^PROXY_PORT=(.*)$" | ForEach-Object{$_.Matches[0].Groups[1].Value}
    }
}
if ($null -eq $env:WP07_PROXY_USER) {
    $val = Get-Content "$scriptDir\CONFIG" | Select-String "^PROXY_USER=(.*)$" | ForEach-Object{$_.Matches[0].Groups[1].Value}
    if ($val) {
        $env:WP07_PROXY_USER = Get-Content "$scriptDir\CONFIG" | Select-String "^PROXY_USER=(.*)$" | ForEach-Object{$_.Matches[0].Groups[1].Value}
    }
}
if ($null -eq $env:WP07_PROXY_PASSWORD) {
    $val = Get-Content "$scriptDir\CONFIG" | Select-String "^PROXY_PASSWORD=(.*)$" | ForEach-Object{$_.Matches[0].Groups[1].Value}
    if ($val) {
        $env:WP07_PROXY_PASSWORD = Get-Content "$scriptDir\CONFIG" | Select-String "^PROXY_PASSWORD=(.*)$" | ForEach-Object{$_.Matches[0].Groups[1].Value}
    }
}

# Installation paths
# ------------------
$nodeRootPath = "$scriptDir\node-v18.12.1-win-x64"
$dssRootPath = "$scriptDir\dss-demo-bundle-5.11.1"
$dssServerConfigPath = "$dssRootPath\apache-tomcat-8.5.82\conf\server.xml" # apache config file
$localModulePath = "$scriptDir\local-module"
$nodeUrl = "https://nodejs.org/dist/v18.12.1/node-v18.12.1-win-x64.zip"
$dssUrl = "https://ec.europa.eu/digital-building-blocks/artifact/repository/esignaturedss/eu/europa/ec/joinup/sd-dss/dss-demo-bundle/5.11.1/dss-demo-bundle-5.11.1.zip"

# Miscellaneous parameters
# ------------------------
$dssPidFilePath = "$scriptDir\dss.pid"
$dssPort=$env:WP07_DSS_BASEURL.split(":")[2]

function Stop-ProcessTree
{
    Param(
        [Parameter(Mandatory=$True,Position=1)]
            [int]$parentProcessId
    )
    Get-WmiObject win32_process | where {$_.ParentProcessId -eq $parentProcessId} | ForEach { Stop-ProcessTree $_.ProcessId }
    Get-WmiObject win32_process | where {$_.ParentProcessId -eq $parentProcessId} | ForEach { Stop-Process $_.ProcessId 2>$null }
}

function Start-DSS {
    # HACK: Replace the server's default port by in-file substitution.
    #       Unfortunately, there is no easier method as we're not in control of
    #       the server's configuration.
    [xml]$cfg = Get-Content $dssServerConfigPath
    $cfg.Server.Service.Connector.port = "$dssPort"
    $cfg.Save($dssServerConfigPath) # NOTE: writeback requires abspath

    # Start DSS in its proper environment and write the (parent cmd.exe's) process id to file.
    $env:JAVA_HOME = "$dssRootPath\java"
    $env:JRE_HOME = $env:JAVA_HOME
    $env:Path = "$env:JAVA_HOME\bin;$env:Path"
    $env:CATALINA_HOME = "$dssRootPath\apache-tomcat-8.5.82"
    Start-Process -FilePath cmd.exe `
        -ArgumentList "/c", "$dssRootPath\apache-tomcat-8.5.82\bin\catalina.bat run" `
        -RedirectStandardError "NUL" -RedirectStandardOut "..\NUL" -NoNewWindow `
        -PassThru |
        Select-Object -ExpandProperty Id |
        Out-File -FilePath "$dssPidFilePath"
}

function Stop-DSS {
    if (Test-Path -Path $dssPidFilePath) {
        $dssPid = Get-Content -Path $dssPidFilePath -First 1
        # NOTE: We kill the process and its children. For unknown reasons
        #       just killing the cmd.exe parent process worked for the
        #       regular user, but failed if the scripts was run in an
        #       administrator powershell.
        Stop-ProcessTree $dssPid
        Remove-Item $dssPidFilePath
    } else {
        Write-Host "Stop-Dss: Pidfile '$dssPidFilePath' not found."
    }
}

function dss_configure_proxy {
    if ($null -eq $args[0]) {
        $txt = @"
proxy.http.enabled = false
proxy.https.enabled = false

"@
    } else {
        $proxy_host = $args[0]
        $proxy_port = $args[1]
        $txt = @"
proxy.http.enabled = true
proxy.http.host = $proxy_host
proxy.http.port = $proxy_port
proxy.https.enabled = true
proxy.https.host = $proxy_host
proxy.https.port = $proxy_port

"@
        if ($null -ne $args[2]) {
            $proxy_basicauth_user = $args[2]
            $proxy_basicauth_password = $args[3]
            $txt = $txt + @"
proxy.http.user = $proxy_basicauth_user
proxy.http.password = $proxy_basicauth_password
proxy.https.user = $proxy_basicauth_user
proxy.https.password = $proxy_basicauth_password

"@
        }
    }

    Set-Content -Path "$dssRootPath\apache-tomcat-8.5.82\lib\dss-custom.properties" -Value $txt
}

# If needed, downloads missing dependencies (dss, standalone node, local
# module). Whether a dependency needs to be downloaded is asserted from the
# existence of the respective directory (dss, local module and node root
# directory).
#
# The contents of a directory, if it exists, are not further inspected. In
# order to issue a full re-download of a component delete its directory.
function Install-Dependencies ($what, $lmver = "latest") {
    if (($what -eq "node") -or ($what -eq "all")) {
        if (Test-Path -Path $nodeRootPath) {
            Write-Host "Standalone nodejs distribution found at '$nodeRootPath'."
        }
        else {
            Write-Host "Standalone nodejs distribution not found at '$nodeRootPath'. Starting download ..."
            Invoke-WebRequest -Uri $nodeUrl -OutFile "$scriptDir\node.zip"
            Write-Host "Extracting archive ..."
            Expand-Archive -Path "$scriptDir\node.zip" -DestinationPath $scriptDir
        }
    }

    if (($what -eq "dss") -or ($what -eq "all")) {
        if (Test-Path -Path $dssRootPath) {
            Write-Host "DSS installation found at '$dssRootPath'."
        }
        else {
            Write-Host "Dss installation not found at '$dssRootPath'. Starting download ..."
            Invoke-WebRequest -Uri $dssUrl -OutFile "$scriptDir\dss.zip"
            Write-Host "Extracting archive ..."
            Expand-Archive -Path "$scriptDir/dss.zip" -DestinationPath $scriptDir
        }
    }

    if (($what -eq "local-module") -or ($what -eq "all")) {
        if (Test-Path -Path $localModulePath) {
            Write-Host "Local module installation found at '$localModulePath'."
        }
        else {
            Write-Host "Local module installation not found at '$localModulePath'. Starting download ..."
            if ($lmver -eq "latest") {
                $suffix = "latest"
            } else {
                $suffix = "tags/$lmver"
            }
            $lmurl = "https://api.github.com/repos/bird-wp07/local-module/releases/$suffix"
            $zipBallUrl = Invoke-WebRequest -Uri $lmurl -ContentType "application/json" -Method Get -UseBasicParsing |
                Select-Object -Expand Content |
                ConvertFrom-Json |
                Select-Object -Expand zipball_url
            Invoke-WebRequest -Uri $zipballUrl -OutFile "$scriptDir\lm.zip"
            Expand-Archive -Path lm.zip -DestinationPath $localModulePath

            # Remove subdirectory in archive (equivalent of tar --strip-components 1).
            $subdirName = Get-ChildItem -Path $localModulePath |
                Select-Object -first 1 |
                Select-Object -Expand Name
            Copy-Item -Recurse "$localModulePath\$subdirName\*" -Destination "$localModulePath"
            Remove-Item -Recurse "$localModulePath\$subdirName"

            $env:Path = "$nodeRootPath;$env:Path"
            Push-Location $localModulePath
            npm install
            npm run build-windows
            Pop-Location
        }
    }
}

function main {
    $version = "latest"
    if (Test-Path -Path "$scriptDir\VERSION") {
        $version = Get-Content -Path "$scriptDir\VERSION"
    }
    Install-Dependencies all $version

    try {
        dss_configure_proxy $env:WP07_PROXY_HOST $env:WP07_PROXY_PORT $env:WP07_PROXY_USER $env:WP07_PROXY_PASSWORD
        Start-DSS

        $env:Path = "$nodeRootPath;$env:Path"
        Push-Location $localModulePath
        npm run start-windows
        Pop-Location
    }
    finally {
        Stop-DSS
        Set-Location $scriptDir
    }
}

Switch ($args[0]) {
    stop-dss { Stop-DSS }
    start-dss { Start-DSS }
    install-dependencies { Install-Dependencies $args[1] $(Get-Content -Path VERSION) }
    default { main }
}