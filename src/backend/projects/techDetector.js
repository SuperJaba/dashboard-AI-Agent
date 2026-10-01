import fs from 'fs';
import path from 'path';

/**
 * Detects technology stack based on files present in directory.
 */
export function detectTechnology(dirPath) {
  if (!dirPath) return 'Unknown';
  let target = dirPath.trim().replace(/^["']|["']$/g, '');
  if (target.startsWith('~/')) {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    target = path.join(home, target.slice(2));
  }
  target = path.resolve(target);
  if (!fs.existsSync(target)) return 'Unknown';

  try {
    const files = fs.readdirSync(target);
    if (files.includes('package.json')) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps?.next) return 'Next.js (Node.js)';
        if (deps?.nuxt) return 'Nuxt.js (Vue)';
        if (deps?.svelte) return 'Svelte';
        if ((deps?.react || deps?.['react-dom']) && (deps?.vite || files.includes('vite.config.ts') || files.includes('vite.config.js'))) return 'React / Vite';
        if (deps?.['react-native']) return 'React Native';
        if (deps?.react || deps?.['react-dom']) return 'React';
        if (deps?.vue) return 'Vue';
        if (deps?.['@angular/core']) return 'Angular';
        if (deps?.['@nestjs/core']) return 'NestJS';
        if (deps?.fastify) return 'Fastify';
        if (deps?.express) return 'Node.js Express';
        if (deps?.typescript || files.includes('tsconfig.json')) return 'TypeScript';
        return 'Node.js / JS';
      } catch {
        return 'Node.js / JS';
      }
    } else if (files.includes('pom.xml')) {
      return 'Java Maven';
    } else if (files.includes('build.gradle') || files.includes('build.gradle.kts')) {
      return 'Java Gradle';
    } else if (files.includes('requirements.txt') || files.includes('pyproject.toml') || files.includes('Pipfile') || files.includes('setup.py')) {
      return 'Python';
    } else if (files.includes('Cargo.toml')) {
      return 'Rust';
    } else if (files.includes('go.mod')) {
      return 'Go';
    } else if (files.includes('composer.json')) {
      return 'PHP';
    } else if (files.some(f => f.endsWith('.csproj') || f.endsWith('.sln'))) {
      return 'C# / .NET';
    } else if (files.includes('CMakeLists.txt') || files.includes('Makefile')) {
      return 'C / C++';
    } else if (files.some(f => f.endsWith('.py'))) {
      return 'Python';
    } else if (files.some(f => f.endsWith('.ts') || f.endsWith('.tsx'))) {
      return 'TypeScript';
    } else if (files.some(f => f.endsWith('.js') || f.endsWith('.jsx'))) {
      return 'JavaScript';
    } else if (files.includes('index.html')) {
      return 'HTML / Web';
    }
  } catch {
    return 'Unknown';
  }
  return 'Unknown';
}
