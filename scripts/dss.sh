#!/usr/bin/env zsh

# Utility script to start and stop containerized instances of the DSS. See
# --help for full command list.

set -e
cd $(dirname ${0:A:h}) # cd into project root
source ./scripts/common.sh

dss_run() {
    if [[ "$1" == "-d" ]]; then
        detach="d"
        shift
    fi

    if [[ "$1" != "" ]]; then
        if [[ ! "$1" =~ ^[1-9][0-9]*$ ]]; then
            die "Invalid port: '$1'"
        fi
        port=$1
    else
        port=8080
    fi

    build_docker_image
    docker run -it${detach} -p $port:8089 --rm --name "$PROJECT_DOCKER_IMAGE_NAME-dss-$port" "$PROJECT_DOCKER_IMAGE_NAME" ./start.sh start_dss
}

dss_stop() {
    if [[ "$1" =~ ^[1-9][0-9]*$ ]]; then
        if [[ ! "$1" =~ ^[1-9][0-9]*$ ]]; then
            die "Invalid port: '$1'"
        fi
        name="$IMAGE_NAME-$1"
    else
        name="$IMAGE_NAME-"
    fi
    docker container ls \
        --filter "name=$name" \
        -q | xargs docker container stop 2>/dev/null || true
}

dss_ls() {
    [[ "$1" == "-q" ]] && quiet="-q"
    docker container ls --filter "name=$IMAGE_NAME-" $quiet
}

usage() {
    echo "Bootstrap DSS via docker containers. Usage:

    \033[32;1m${ZSH_ARGZERO:A:t} run [-d] [HOST_PORT]\033[0m
        Spawns a DSS container exposed at port HOST_PORT (default: 8080).
        Optionally, use -d to run the container as a background process.

    \033[32;1m${ZSH_ARGZERO:A:t} stop [HOST_PORT]\033[0m
        Stops a DSS container exposed at port PORT. If no port is provided, all
        DSS containers are stopped.

    \033[32;1m${ZSH_ARGZERO:A:t} ls [-q]\033[0m
        Produces a listing of all running DSS containers. Using -q will return
        only the containers' ids."
}

case $1 in
ls|run|stop)
    cmd=$1
    shift
    dss_$cmd $@
    ;;
@)
    shift
    $@
    ;;
*)
    usage
    exit
    ;;
esac
