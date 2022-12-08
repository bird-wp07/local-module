#!/usr/bin/env zsh

DOCKERFILE_PATH="./docker/dss.Dockerfile"
IMAGE_NAME="wp07-dss"

_die() {
    echo "$1" >&2
    exit 1
}

dss_run() {
    if [[ "$1" == "-d" ]]; then
        detach="-d"
        shift
    fi
    
    if [[ "$1" != "" ]]; then
        if [[ ! "$1" =~ ^[1-9][0-9]*$ ]]; then
            _die "Invalid port: '$1'"
        fi
        port=$1
    else
        port=8080
    fi

    docker build -t $IMAGE_NAME -f $DOCKERFILE_PATH .
    docker container run $detach -p $port:8080 --rm -t --name "$IMAGE_NAME-$port" $IMAGE_NAME
}

dss_stop() {
    if [[ "$1" =~ ^[1-9][0-9]*$ ]]; then
        if [[ ! "$1" =~ ^[1-9][0-9]*$ ]]; then
            _die "Invalid port: '$1'"
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
    echo "Control DSS docker containers. Usage:
    
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

cd $(dirname ${0:A:h})
case $1 in
ls|run|stop)
    cmd=$1
    shift
    dss_$cmd $@
;;
*) usage; exit ;;
esac
