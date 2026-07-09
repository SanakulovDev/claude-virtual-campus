"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MARKER_RULES = void 0;
exports.MARKER_RULES = [
    // Languages / runtimes
    { id: 'php', displayName: 'PHP', category: 'language', filenames: ['composer.json', 'composer.lock'], extensions: ['.php'], confidence: 0.9 },
    { id: 'python', displayName: 'Python', category: 'language', filenames: ['pyproject.toml', 'requirements.txt', 'requirements-dev.txt', 'Pipfile', 'setup.py'], extensions: ['.py'], confidence: 0.9 },
    { id: 'go', displayName: 'Go', category: 'language', filenames: ['go.mod', 'go.sum'], extensions: ['.go'], confidence: 0.95 },
    { id: 'typescript', displayName: 'TypeScript', category: 'language', filenames: ['tsconfig.json'], extensions: ['.ts', '.tsx'], confidence: 0.85 },
    { id: 'javascript', displayName: 'JavaScript', category: 'language', filenames: ['package.json'], extensions: ['.js', '.mjs', '.cjs'], confidence: 0.6 },
    { id: 'rust', displayName: 'Rust', category: 'language', filenames: ['Cargo.toml', 'Cargo.lock'], extensions: ['.rs'], confidence: 0.95 },
    { id: 'java', displayName: 'Java', category: 'language', filenames: ['pom.xml', 'build.gradle', 'build.gradle.kts'], extensions: ['.java'], confidence: 0.9 },
    { id: 'kotlin', displayName: 'Kotlin', category: 'language', extensions: ['.kt', '.kts'], confidence: 0.8 },
    { id: 'ruby', displayName: 'Ruby', category: 'language', filenames: ['Gemfile', 'Gemfile.lock'], extensions: ['.rb'], confidence: 0.9 },
    { id: 'dotnet', displayName: '.NET / C#', category: 'language', extensions: ['.csproj', '.sln', '.cs'], confidence: 0.9 },
    { id: 'c-cpp', displayName: 'C / C++', category: 'language', filenames: ['CMakeLists.txt', 'Makefile', 'meson.build'], extensions: ['.c', '.cpp', '.cc', '.h', '.hpp'], confidence: 0.75 },
    { id: 'elixir', displayName: 'Elixir', category: 'language', filenames: ['mix.exs', 'mix.lock'], extensions: ['.ex', '.exs'], confidence: 0.9 },
    // Frameworks (content-sniffed from small manifest reads)
    { id: 'laravel', displayName: 'Laravel', category: 'framework', filenames: ['artisan'], confidence: 0.9, contentSniff: { filename: 'composer.json', needle: 'laravel/framework' } },
    { id: 'symfony', displayName: 'Symfony', category: 'framework', filenames: ['symfony.lock'], confidence: 0.85, contentSniff: { filename: 'composer.json', needle: 'symfony/' } },
    { id: 'django', displayName: 'Django', category: 'framework', filenames: ['manage.py'], confidence: 0.9 },
    { id: 'fastapi', displayName: 'FastAPI', category: 'framework', confidence: 0.7, contentSniff: { filename: 'pyproject.toml', needle: 'fastapi' } },
    { id: 'flask', displayName: 'Flask', category: 'framework', confidence: 0.6, contentSniff: { filename: 'requirements.txt', needle: 'flask' } },
    { id: 'nextjs', displayName: 'Next.js', category: 'framework', confidence: 0.7, contentSniff: { filename: 'package.json', needle: '"next"' } },
    { id: 'nestjs', displayName: 'NestJS', category: 'framework', confidence: 0.7, contentSniff: { filename: 'package.json', needle: '@nestjs/core' } },
    { id: 'rails', displayName: 'Ruby on Rails', category: 'framework', filenames: ['config.ru'], confidence: 0.8, contentSniff: { filename: 'Gemfile', needle: 'rails' } },
    // Package managers
    { id: 'composer', displayName: 'Composer', category: 'package-manager', filenames: ['composer.json', 'composer.lock'], confidence: 0.9 },
    { id: 'pip', displayName: 'pip', category: 'package-manager', filenames: ['requirements.txt'], confidence: 0.7 },
    { id: 'poetry', displayName: 'Poetry', category: 'package-manager', filenames: ['poetry.lock'], confidence: 0.9 },
    { id: 'uv', displayName: 'uv', category: 'package-manager', filenames: ['uv.lock'], confidence: 0.9 },
    { id: 'pipenv', displayName: 'Pipenv', category: 'package-manager', filenames: ['Pipfile', 'Pipfile.lock'], confidence: 0.85 },
    { id: 'npm', displayName: 'npm', category: 'package-manager', filenames: ['package-lock.json'], confidence: 0.85 },
    { id: 'pnpm', displayName: 'pnpm', category: 'package-manager', filenames: ['pnpm-lock.yaml'], confidence: 0.9 },
    { id: 'yarn', displayName: 'Yarn', category: 'package-manager', filenames: ['yarn.lock'], confidence: 0.9 },
    { id: 'bun', displayName: 'Bun', category: 'package-manager', filenames: ['bun.lock', 'bun.lockb'], confidence: 0.9 },
    { id: 'bundler', displayName: 'Bundler', category: 'package-manager', filenames: ['Gemfile.lock'], confidence: 0.85 },
    { id: 'cargo', displayName: 'Cargo', category: 'package-manager', filenames: ['Cargo.toml'], confidence: 0.9 },
    // Build tools
    { id: 'maven', displayName: 'Maven', category: 'build-tool', filenames: ['pom.xml'], confidence: 0.9 },
    { id: 'gradle', displayName: 'Gradle', category: 'build-tool', filenames: ['build.gradle', 'build.gradle.kts', 'gradlew'], confidence: 0.9 },
    { id: 'make', displayName: 'Make', category: 'build-tool', filenames: ['Makefile'], confidence: 0.7 },
    { id: 'cmake', displayName: 'CMake', category: 'build-tool', filenames: ['CMakeLists.txt'], confidence: 0.85 },
    { id: 'ninja', displayName: 'Ninja', category: 'build-tool', filenames: ['build.ninja'], confidence: 0.85 },
    { id: 'dotnet-sdk', displayName: '.NET SDK', category: 'build-tool', extensions: ['.csproj', '.sln'], confidence: 0.8 },
    // Test tools (content-sniffed, best-effort)
    { id: 'phpunit', displayName: 'PHPUnit', category: 'test-tool', confidence: 0.7, contentSniff: { filename: 'composer.json', needle: 'phpunit/phpunit' } },
    { id: 'pest', displayName: 'Pest', category: 'test-tool', confidence: 0.7, contentSniff: { filename: 'composer.json', needle: 'pestphp/pest' } },
    { id: 'pytest', displayName: 'pytest', category: 'test-tool', confidence: 0.6, contentSniff: { filename: 'pyproject.toml', needle: 'pytest' } },
    { id: 'jest', displayName: 'Jest', category: 'test-tool', confidence: 0.6, contentSniff: { filename: 'package.json', needle: '"jest"' } },
    { id: 'vitest', displayName: 'Vitest', category: 'test-tool', confidence: 0.6, contentSniff: { filename: 'package.json', needle: 'vitest' } },
    { id: 'rspec', displayName: 'RSpec', category: 'test-tool', confidence: 0.6, contentSniff: { filename: 'Gemfile', needle: 'rspec' } },
    // Infrastructure
    { id: 'docker', displayName: 'Docker', category: 'infrastructure', filenames: ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'], confidence: 0.9 },
    { id: 'kubernetes', displayName: 'Kubernetes', category: 'infrastructure', confidence: 0.5, contentSniff: { filename: 'Chart.yaml', needle: 'apiVersion' } },
    { id: 'terraform', displayName: 'Terraform', category: 'infrastructure', extensions: ['.tf'], confidence: 0.85 },
];
