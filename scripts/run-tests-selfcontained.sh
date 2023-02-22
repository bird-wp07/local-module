#!/usr/bin/env zsh

# Executes all tests inside a self-contained ephemeral container. See --help
# for detailed usage.

set -e
cd $(dirname ${0:A:h}) # cd into project root
source ./scripts/common.sh

if [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
    echo "Bootstraps DSS, the local module and runs all tests in an ephemeral container.

    Usage: \033[32;1m$ZSH_ARGZERO\033[0m

The local module is run via \033[1mnpm run start\033[0m from the current working
tree (not the github repository)."
    exit
fi

run_container() {
    build_docker_image
    # TODO: Use git and shellmagic to dynamically generate this list.
    #       Separate versioned files from non-versioned files containing secrets.
    docker run -it --rm \
        -v "$(realpath ./assets)":/root/assets \
        -v "$(realpath ./bundle)":/root/bundle \
        -v "$(realpath ./docs)":/root/docs \
        -v "$(realpath ./.eslintrc)":/root/.eslintrc \
        -v "$(realpath ./.github)":/root/.github \
        -v "$(realpath ./.gitignore)":/root/.gitignore \
        -v "$(realpath ./.mocharc.yml)":/root/.mocharc.yml \
        -v "$(realpath ./package.json)":/root/package.json \
        -v "$(realpath ./package-lock.json)":/root/package-lock.json \
        -v "$(realpath ./prettierrc)":/root/prettierrc \
        -v "$(realpath ./README.md)":/root/README.md \
        -v "$(realpath ./scripts)":/root/scripts \
        -v "$(realpath ./src)":/root/src \
        -v "$(realpath ./tests)":/root/tests \
        -v "$(realpath ./tsconfig.json)":/root/tsconfig.json \
        -v "$(realpath ./.env)":/root/.env \
        -v "$(realpath ./cs-auth-mtls-client-certkey.p12)":/root/cs-auth-mtls-client-certkey.p12 \
        -v "$(realpath ./cs-auth-mtls-server-cert.pem)":/root/cs-auth-mtls-server-cert.pem \
        $PROJECT_DOCKER_IMAGE_NAME /bin/zsh ./scripts/run-tests-selfcontained.sh run_tests
}

# This is executed inside the container. We must go deeper.
run_tests() {
    cat .env | grep -E '^[A-Za-z0-9_]+=.+$' | while read line; do
        k="$(printf -- "$line" | cut -d= -f1)"
        v="$(printf -- "$line" | cut -d= -f2-)"
        eval "export $k=$v"
    done
    ./start.sh start_dss >/dev/null 2>&1 &

    # NOTE: We want to install for, build and run the local module from the
    #       current working tree, not the github repository. Thus we do not
    #       use ./start.sh start_lm.
    npm install
    npm run build
    WP07_LOCAL_MODULE_SIGNAL_PID=$$ npm run start:nobuild &

    # Wait for local module startup to finish to send a signal to this process
    # to continue execution.
    # TODO: Remove signal and just poll /system/health
    trap 'lm_ready=1' USR1
    lm_ready=0
    while [ "$lm_ready" -ne 1 ]; do
        sleep 1
    done

    npm run test:nobuild
}

case "$1" in
@) shift; "$@" ;;
"") run_container ;;
run_tests) run_tests ;;
*) $ZSH_ARGZERO --help && exit 1 ;;
esac