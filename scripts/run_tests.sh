#!/usr/bin/env zsh

if [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
    echo "Run tests by filename prefix.

    Usage: $ZSH_ARGZERO TEST_A [TEST_B]...

will execute \033[1m./dist-test/TEST_A.test.js\033[0m and \033[1m./dist-test/TEST_B.test.js\033[0m."

    exit
fi

cd ../${0:A:h}
npx mocha ./dist-test/tests/${^@}.test.js
