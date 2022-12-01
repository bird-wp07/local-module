#!/usr/bin/env zsh

DOCKERFILE_PATH="./docker/dss.Dockerfile"
IMAGE_NAME="wp07-dss"


_die() {
    echo "$1" >&2
    exit 1
}

dss_run() {
    if [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
        cat <<<"Spawn DSS containers

    Usage: $ZSH_ARGZERO ${0:gs/_/ } [-d] [PORT]

Spawns a DSS container exposed at port PORT (default: 8080). Optionally, use -d
to run the container as a background process."
        exit
    fi

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
    if [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
        cat <<<"Stop DSS containers

    Usage: $ZSH_ARGZERO ${0:gs/_/ } [PORT]

Stops a DSS container exposed at port PORT. If no port is provided, all DSS
containers are stopped."
        exit
    fi

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
    if [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
        cat <<<"List all running DSS containers

    Usage: $ZSH_ARGZERO ${0:gs/_/ } [-q]

Produces a listing of all running DSS containers. Using -q will return only the
containers' ids."
        exit
    fi

    [[ "$1" == "-q" ]] && quiet="-q"
    docker container ls --filter "name=$IMAGE_NAME-" $quiet
}

dss() {
    if [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
        cat <<<"Control DSS containers.

    Usage: $ZSH_ARGZERO ${0:gs/_/ /} COMMAND ...

Available commands:"
    print -l ${(ok)functions} | grep -E "^$0_" | sed -E "s/^$0_//g" | while read cmd; do
        help="$($ZSH_ARGZERO $0_$cmd --help | head -1)"
        echo "    ${(r:10:)cmd:gs/_/ /}$help"
    done
    echo "\nSee COMMAND --help for more information"
    exit
    fi

    dss_"$@"
}

if [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
    cat <<<"Usage: $ZSH_ARGZERO COMMAND ...

Available commands:"
    print -l ${(ok)functions} | grep -vE "_" | while read cmd; do
        {
            echo -n "$cmd\t\t"
            $0 "$cmd" --help | head -1
        } | sed -E 's/.*/    &/'
    done
    echo "\nSee COMMAND --help for more information"
    exit
fi

cd "${0:A:h}"
"$@"

# TODO: Get rid of super command boilerplate via decorators.