#!/usr/bin/env zsh
set -e

if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    cat <<<'Publish a release to github.

Package version is determined from package.json. Implicitly publishes to npm.'
    exit 0
fi

# TODO: insert npm run test after tests are self-contained (#22)

npm run publish_npmjs
package_version="$(cat package.json | jq -r .version)"
git fetch --tags
git tag -a "v$package_version" -m "release v$package_version"
git push origin "v$package_version"
