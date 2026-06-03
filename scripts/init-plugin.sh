#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  bun run init-plugin <plugin-slug> [ClassName] [package.id] [GitHubOrg] [android-lang]

Arguments:
  plugin-slug   Required, lowercase slug without scope (example: downloader)
  ClassName     Optional, PascalCase plugin class (default from slug)
  package.id    Optional, Android/iOS reverse DNS id (default: app.capgo.<slug>)
  GitHubOrg     Optional, repository org/user (default: Cap-go)
  android-lang  Optional 5th argument, Android language: java or kotlin (default: java)

Notes:
  To use Kotlin while keeping the default GitHub org, pass "Cap-go" as the 4th
  argument and "kotlin" as the 5th argument.

Example:
  bun run init-plugin downloader CapacitorDownloader app.capgo.downloader Cap-go kotlin
USAGE
}

to_pascal_case() {
  local input="${1//[^a-zA-Z0-9]/ }"
  local out=""
  local part
  for part in $input; do
    local first
    local rest
    first="$(printf '%s' "${part:0:1}" | tr '[:lower:]' '[:upper:]')"
    rest="$(printf '%s' "${part:1}" | tr '[:upper:]' '[:lower:]')"
    out+="${first}${rest}"
  done
  printf '%s' "$out"
}

write_kotlin_build_gradle() {
  copy_kotlin_template \
    "scripts/templates/kotlin/android/build.gradle.template" \
    "android/build.gradle"
}

copy_kotlin_template() {
  local source="$1"
  local destination="$2"

  mkdir -p "$(dirname "$destination")"
  cp "$source" "$destination"
}

write_kotlin_android_sources() {
  local template_root="scripts/templates/kotlin/android/src/main/kotlin"
  local kotlin_dir="android/src/main/kotlin/$package_path"
  local template_java_dir="android/src/main/java/app/capgo/plugintemplate"

  mkdir -p "$kotlin_dir"
  rm -rf "$template_java_dir"
  copy_kotlin_template "$template_root/PluginTemplate.kt.template" "$kotlin_dir/${class_name}.kt"
  copy_kotlin_template "$template_root/PluginTemplatePlugin.kt.template" "$kotlin_dir/${plugin_class_name}.kt"
}

if [[ $# -lt 1 || $# -gt 5 ]]; then
  usage
  exit 1
fi

slug="$1"
class_name="${2:-$(to_pascal_case "$slug")}"
package_id="${3:-app.capgo.${slug//-/_}}"
github_org="${4:-Cap-go}"
android_lang="$(printf '%s' "${5:-java}" | tr '[:upper:]' '[:lower:]')"

if [[ ! "$slug" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
  echo "Invalid plugin slug: $slug"
  echo "Use lowercase letters, numbers, and dashes only."
  exit 1
fi

if [[ ! "$class_name" =~ ^[A-Za-z][A-Za-z0-9]*$ ]]; then
  echo "Invalid class name: $class_name"
  echo "Use PascalCase letters/numbers only."
  exit 1
fi

if [[ ! "$package_id" =~ ^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$ ]]; then
  echo "Invalid package id: $package_id"
  echo "Expected reverse DNS format, for example: app.capgo.downloader"
  exit 1
fi

if [[ ! "$android_lang" =~ ^(java|kotlin)$ ]]; then
  echo "Invalid android language: $android_lang"
  echo 'Use "java" or "kotlin".'
  exit 1
fi

repo_name="capacitor-$slug"
package_name="@capgo/$repo_name"
native_name="CapgoCapacitor${class_name}"
plugin_class_name="${class_name}Plugin"
package_path="${package_id//./\/}"
first_char="${class_name:0:1}"
first_char_lower="$(printf '%s' "$first_char" | tr '[:upper:]' '[:lower:]')"
rollup_name="capacitor${first_char_lower}${class_name:1}"
repo_full_name="${github_org}/${repo_name}"
repo_url="https://github.com/${github_org}/${repo_name}"

file_list="$(mktemp -t capgo-plugin-template-files)"
trap 'rm -f "$file_list"' EXIT

find . -type f \
  ! -path './.git/*' \
  ! -path './node_modules/*' \
  ! -path './dist/*' \
  ! -path './android/.gradle/*' \
  ! -path './android/build/*' \
  ! -path './example-app/node_modules/*' \
  ! -path './example-app/dist/*' \
  > "$file_list"

replace_all() {
  local search="$1"
  local replace="$2"
  if [[ "$search" == "$replace" ]]; then
    return
  fi

  local file
  while IFS= read -r file; do
    SEARCH="$search" REPLACE="$replace" perl -0pi -e 's/\Q$ENV{SEARCH}\E/$ENV{REPLACE}/g' "$file"
  done < "$file_list"
}

replace_all '@capgo/capacitor-plugin-template' "$package_name"
replace_all 'https://github.com/Cap-go/capacitor-plugin-template' "$repo_url"
replace_all 'Cap-go/capacitor-plugin-template' "$repo_full_name"
replace_all 'capacitor-plugin-template' "$repo_name"
replace_all 'CapgoCapacitorPluginTemplate' "$native_name"
replace_all 'PluginTemplatePlugin' "$plugin_class_name"
replace_all 'PluginTemplate' "$class_name"
replace_all 'app.capgo.plugintemplate' "$package_id"
replace_all 'app/capgo/plugintemplate' "$package_path"
replace_all 'capacitorPluginTemplate' "$rollup_name"

if [[ -f "CapgoCapacitorPluginTemplate.podspec" ]]; then
  mv "CapgoCapacitorPluginTemplate.podspec" "${native_name}.podspec"
fi

if [[ -d "ios/Sources/PluginTemplatePlugin" ]]; then
  mv "ios/Sources/PluginTemplatePlugin" "ios/Sources/${plugin_class_name}"
fi

if [[ -d "ios/Tests/PluginTemplatePluginTests" ]]; then
  mv "ios/Tests/PluginTemplatePluginTests" "ios/Tests/${plugin_class_name}Tests"
fi

if [[ -f "ios/Sources/${plugin_class_name}/PluginTemplate.swift" ]]; then
  mv "ios/Sources/${plugin_class_name}/PluginTemplate.swift" "ios/Sources/${plugin_class_name}/${class_name}.swift"
fi

if [[ -f "ios/Sources/${plugin_class_name}/PluginTemplatePlugin.swift" ]]; then
  mv "ios/Sources/${plugin_class_name}/PluginTemplatePlugin.swift" "ios/Sources/${plugin_class_name}/${plugin_class_name}.swift"
fi

if [[ -f "ios/Tests/${plugin_class_name}Tests/PluginTemplateTests.swift" ]]; then
  mv "ios/Tests/${plugin_class_name}Tests/PluginTemplateTests.swift" "ios/Tests/${plugin_class_name}Tests/${class_name}Tests.swift"
fi

if [[ "$android_lang" == "java" ]]; then
  if [[ -d "android/src/main/java/app/capgo/plugintemplate" ]]; then
    mkdir -p "android/src/main/java/$(dirname "$package_path")"
    mv "android/src/main/java/app/capgo/plugintemplate" "android/src/main/java/$package_path"
  fi

  if [[ -f "android/src/main/java/$package_path/PluginTemplate.java" ]]; then
    mv "android/src/main/java/$package_path/PluginTemplate.java" "android/src/main/java/$package_path/${class_name}.java"
  fi

  if [[ -f "android/src/main/java/$package_path/PluginTemplatePlugin.java" ]]; then
    mv "android/src/main/java/$package_path/PluginTemplatePlugin.java" "android/src/main/java/$package_path/${plugin_class_name}.java"
  fi
else
  write_kotlin_build_gradle
  write_kotlin_android_sources
fi

echo "Template initialized."
echo "Package: $package_name"
echo "Class: $class_name"
echo "Package ID: $package_id"
echo "Android language: $android_lang"
echo "README banner repo: $repo_full_name"
echo "Repo URL: $repo_url"
echo "GitHub repo social preview: edit assets/github-social-template.svg, export assets/github-social-preview.png, then upload it at GitHub Settings -> General -> Social preview. Use authenticated browser automation when available."
