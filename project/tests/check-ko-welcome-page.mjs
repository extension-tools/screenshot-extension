import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(projectRoot, '..');
const pagePath = path.join(repoRoot, 'docs', 'ko', 'index.html');
const html = fs.readFileSync(pagePath, 'utf8');

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const expectedCopy = [
  'Screenshot Extension 설치가 끝났어요! 🎉',
  '이렇게 시작해 보세요.',
  '브라우저 오른쪽 위에 있는 퍼즐 모양 아이콘(1)을 클릭하세요.',
  '그런 다음, 확장 프로그램 옆에 있는 고정 핀(2)을 클릭하세요:',
  '이게 전부예요! 이제 어느 페이지에서든 아이콘(3)을 클릭하면 바로 사용할 수 있어요.'
];

assert(/<html\s+lang="ko">/.test(html), 'Korean welcome page must declare lang="ko"');
assert(
  html.includes('font-family: system-ui') && html.includes('"Apple SD Gothic Neo"') && html.includes('"Noto Sans KR"'),
  'Korean welcome page must keep the approved system font stack'
);

for (const text of expectedCopy) {
  assert(html.includes(text), `Korean welcome page is missing approved copy: ${text}`);
}

for (const oldSourceText of [
  "Here's how to get started.",
  'Click the puzzle-shaped icon (1) at the top right of your browser.',
  "That's it! Now on any page, click the icon (3) and you're ready to go."
]) {
  assert(!html.includes(oldSourceText), `Korean welcome page still contains English source copy: ${oldSourceText}`);
}

for (const altText of [
  'Chrome 확장 프로그램 메뉴에서 Screenshot Extension을 고정하는 방법',
  '브라우저 도구 모음에서 Screenshot Extension을 여는 방법'
]) {
  assert(html.includes(`alt="${altText}"`), `Korean welcome page is missing Korean image description: ${altText}`);
}

for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  const assetPath = match[1].split('?')[0];
  if (/^(?:https?:)?\/\//.test(assetPath)) {
    throw new Error(`Korean welcome page must not rely on a remote asset: ${assetPath}`);
  }

  assert(
    fs.existsSync(path.resolve(path.dirname(pagePath), assetPath)),
    `Korean welcome page references a missing local asset: ${assetPath}`
  );
}

console.log('Korean welcome page static check passed.');
