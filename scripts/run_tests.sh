#!/usr/bin/env zsh

# cd into project root directory.
cd $(dirname ${0:A:h})

# Name of the directory containing the (typescript) test files.
tests_dir="tests"

# Name of the directory containing the compiled (javascript) test files.
tests_output_dir="$(cat tsconfig.json | grep '"outDir"' | sed -E 's/^.*"outDir":\s*"([^"]+)".*$/\1/')"/"$tests_dir"

if [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
    echo "Wraps mocha to run tests by filename prefix.

    Usage: \033[32;1m$ZSH_ARGZERO [-d] [TEST]...\033[0m

Leaving TEST empty will run all tests. Setting the '-d' flag will run the tests
in debug mode (attaches '--inspect-brk' to \$NODE_OPTIONS)."

    exit
fi

if [ "$1" = "-d" ]; then
    export NODE_OPTIONS="$NODE_OPTIONS --inspect-brk"
    shift
fi

if [ -z "$@" ]; then
    npx mocha "$tests_output_dir/**/*.test.js"
else
    npx mocha "$tests_output_dir"/${^@}.test.js
fi
