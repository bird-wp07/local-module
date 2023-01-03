#!/usr/bin/env zsh
set -e
cd $(dirname ${0:A:h})

if [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
    echo "Bootstraps DSS, the local module and runs all tests in an ephemeral container.

    Usage: \033[32;1m$ZSH_ARGZERO\033[0m

The local module is run via \033[1mnpm run start\033[0m from the current working
tree (not the npm registry or the github repository)."
    exit
fi

run_container() {
    imgname=wp07-containerized-tests
    docker build -t $imgname -f ./docker/Dockerfile ./docker
    # TODO: Use git and shellmagic to dynamically generate this list
    docker run -it --rm \
        -v "$(realpath ./assets)":/root/assets \
        -v "$(realpath ./bin)":/root/bin \
        -v "$(realpath ./bundle)":/root/bundle \
        -v "$(realpath ./docker)":/root/docker \
        -v "$(realpath ./.eslintrc)":/root/.eslintrc \
        -v "$(realpath ./.github)":/root/.github \
        -v "$(realpath ./.gitignore)":/root/.gitignore \
        -v "$(realpath ./.mocharc.yml)":/root/.mocharc.yml \
        -v "$(realpath ./package.json)":/root/package.json \
        -v "$(realpath ./package-lock.json)":/root/package-lock.json \
        -v "$(realpath ./postman.json)":/root/postman.json \
        -v "$(realpath ./prettierrc)":/root/prettierrc \
        -v "$(realpath ./README.md)":/root/README.md \
        -v "$(realpath ./scripts)":/root/scripts \
        -v "$(realpath ./src)":/root/src \
        -v "$(realpath ./tests)":/root/tests \
        -v "$(realpath ./tsconfig.json)":/root/tsconfig.json \
        -v "$(realpath ./tsoa.json)":/root/tsoa.json \
        $imgname /bin/zsh ./scripts/run-tests-selfcontained.sh run_tests
}

# This is executed inside the container. We must go deeper.
run_tests() {
    export WP07_CS_BASEURL=https://46.83.201.35.bc.googleusercontent.com
    export WP07_DSS_BASEURL=http://127.0.0.1:8080
    export WP07_LOCAL_MODULE_BASEURL=http://127.0.0.1:2048
    export WP07_LOCAL_MODULE_SIGNAL_PID=$$

    bash ./dss-demo-bundle-5.11.1/apache-tomcat-8.5.82/bin/catalina.sh run >/dev/null 2>&1 &
    npm install
    npm run start &

    # Wait for local module startup to finish to send a signal to this process
    # to continue execution.
    trap 'lm_ready=1' USR1
    lm_ready=0
    while [ "$lm_ready" -ne 1 ]; do
        sleep 1
    done

    npm run test:nobuild
}

case "$1" in
"") run_container ;;
run_tests) run_tests ;;
*) $ZSH_ARGZERO --help && exit 1 ;;
esac