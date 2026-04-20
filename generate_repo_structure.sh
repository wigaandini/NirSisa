#!/usr/bin/env bash

set -euo pipefail

OUTPUT_FILE="${1:-repo_structure.txt}"
TARGET_DIR="${2:-.}"

IGNORE_DIRS=(
  ".git"
  "node_modules"
  "vendor"
  "dist"
  "build"
  ".next"
  ".nuxt"
  "coverage"
  ".cache"
  ".idea"
  ".vscode"
  "__pycache__"
  ".venv"
  "venv"
  "tmp"
  "logs"
)

IGNORE_FILES=(
  "*.log"
  "*.lock"
  "*.pyc"
  "*.class"
  "*.o"
  "*.so"
  "*.dll"
  "*.exe"
  "*.DS_Store"
)

build_find_prune() {
  local first=1
  printf "("
  for dir in "${IGNORE_DIRS[@]}"; do
    if [ $first -eq 0 ]; then
      printf " -o"
    fi
    printf " -name %q" "$dir"
    first=0
  done
  printf " ) -type d -prune"
}

build_find_file_exclude() {
  for file in "${IGNORE_FILES[@]}"; do
    printf " ! -name %q" "$file"
  done
}

generate_tree() {
  if command -v tree >/dev/null 2>&1; then
    local tree_ignore
    tree_ignore="$(IFS='|'; echo "${IGNORE_DIRS[*]}|${IGNORE_FILES[*]}")"
    tree -a \
      -I "$tree_ignore" \
      --noreport \
      "$TARGET_DIR"
  else
    echo "[INFO] 'tree' tidak ditemukan, pakai fallback dengan find."
    find "$TARGET_DIR" \
      $(build_find_prune) -o \
      -print | sed "s#^$TARGET_DIR#.#" | sort
  fi
}

generate_file_summary() {
  echo
  echo "=================================================="
  echo "FILE SUMMARY"
  echo "=================================================="

  find "$TARGET_DIR" \
    $(build_find_prune) -o \
    -type f \
    $(build_find_file_exclude) \
    -print | sort | while read -r file; do
      rel_path="${file#$TARGET_DIR/}"

      if command -v wc >/dev/null 2>&1; then
        line_count=$(wc -l < "$file" 2>/dev/null || echo 0)
      else
        line_count="N/A"
      fi

      if command -v file >/dev/null 2>&1; then
        file_type=$(file -b "$file" 2>/dev/null || echo "unknown")
      else
        file_type="unknown"
      fi

      size_bytes=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null || echo "N/A")

      printf -- "- %s | lines: %s | size: %s bytes | type: %s\n" \
        "$rel_path" "$line_count" "$size_bytes" "$file_type"
    done
}

generate_metadata() {
  echo "REPOSITORY STRUCTURE REPORT"
  echo "Generated at : $(date '+%Y-%m-%d %H:%M:%S')"
  echo "Target dir   : $(cd "$TARGET_DIR" && pwd)"
  echo
  echo "Ignored dirs : ${IGNORE_DIRS[*]}"
  echo "Ignored files: ${IGNORE_FILES[*]}"
  echo
  echo "=================================================="
  echo "DIRECTORY TREE"
  echo "=================================================="
}

{
  generate_metadata
  generate_tree
  generate_file_summary
} > "$OUTPUT_FILE"

echo "Selesai. Output disimpan ke: $OUTPUT_FILE"