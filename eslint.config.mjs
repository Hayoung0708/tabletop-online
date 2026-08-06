import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import importPlugin from "eslint-plugin-import";
import jsdoc from "eslint-plugin-jsdoc";
import unusedImports from "eslint-plugin-unused-imports";
import prettierConfig from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  jsdoc.configs["flat/recommended-typescript"],

  {
    plugins: {
      import: importPlugin,
      "unused-imports": unusedImports,
    },
    rules: {
      // any 타입 사용 금지
      "@typescript-eslint/no-explicit-any": "error",

      // 타입 추론 대신 명시적 타입을 요구 (함수 경계 한정 — 변수까지 강제하면
      // `const x: number = 5` 처럼 TS 특유의 장점을 없애는 노이즈가 됨)
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/explicit-module-boundary-types": "error",

      // 구조분해 안 된 변수 접근 금지
      "prefer-destructuring": [
        "error",
        { VariableDeclarator: { array: true, object: true } },
        { enforceForRenamedProperties: false },
      ],

      // function 키워드 금지, 화살표 함수만 허용
      "func-style": ["error", "expression"],

      // named import / named export만 허용 (Next.js 특수 파일은 아래 overrides에서 예외 처리)
      "import/no-default-export": "error",
      "unused-imports/no-unused-imports": "error",

      // 하나의 함수는 하나의 일만 — 자동 강제는 불가능해서 경고로 크기 가드만 둠
      "max-lines-per-function": [
        "warn",
        { max: 60, skipBlankLines: true, skipComments: true },
      ],
      complexity: ["warn", 10],
    },
  },

  // 모든 함수에 JSDoc 필수 — 단, 배열 콜백처럼 이름 없는 인라인 함수까지 강제하면
  // 오히려 가독성을 해쳐서 "이름 붙은 함수(선언/변수 할당)"로 범위를 좁힘
  {
    rules: {
      "jsdoc/require-jsdoc": [
        "error",
        {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: false,
            FunctionExpression: false,
          },
          contexts: [
            "VariableDeclaration > VariableDeclarator > ArrowFunctionExpression",
          ],
        },
      ],
      "jsdoc/require-description": "error",
    },
  },

  // Next.js App Router 규칙상 page.tsx / layout.tsx 등은 default export가
  // 강제되는 프레임워크 제약이라 여기서만 named-export-only 규칙을 예외 처리
  {
    files: [
      "src/app/**/page.tsx",
      "src/app/**/layout.tsx",
      "src/app/**/loading.tsx",
      "src/app/**/error.tsx",
      "src/app/**/not-found.tsx",
      "src/app/**/global-error.tsx",
    ],
    rules: {
      "import/no-default-export": "off",
    },
  },

  // Next.js / PostCSS / Prisma 설정 파일들은 각 도구가 default export를 직접
  // 요구해서(우리가 고를 수 있는 부분이 아님) 여기서도 예외 처리
  {
    files: [
      "next.config.ts",
      "postcss.config.mjs",
      "prisma.config.ts",
      "eslint.config.mjs",
    ],
    rules: {
      "import/no-default-export": "off",
    },
  },

  // 순수 계산 유틸/서버 로직은 함수 길이가 자연히 길어질 수 있어 경고 기준 완화
  {
    files: ["src/server/**/*.ts", "src/utils/**/*.ts"],
    rules: {
      "max-lines-per-function": "off",
    },
  },

  prettierConfig,

  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "src/generated/**"]),
]);

export default eslintConfig;
