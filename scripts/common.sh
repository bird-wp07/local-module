#!/dev/null

# These snippets are sourced by other shell scripts (bash AND zsh, beware). All
# relative paths are resolved relative to the project root.

# Docker related
PROJECT_DOCKER_IMAGE_NAME="wp07"
build_docker_image() {
    docker build -t "$PROJECT_DOCKER_IMAGE_NAME" -f "./scripts/Dockerfile" ./scripts
}

# Utility
die() {
    echo "$1" >&2
    exit 1
}
