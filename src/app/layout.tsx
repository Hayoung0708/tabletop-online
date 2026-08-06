import type { JSX } from "react";
import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const pretendard = localFont({
  src: "../assets/fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tabletop Online",
  description: "친구들과 실시간으로 즐기는 온라인 야찌",
};

/**
 * 모든 페이지를 감싸는 루트 레이아웃. 폰트 변수와 공통 배경/텍스트 색을 세팅한다.
 * @param props - 자식 페이지 엘리먼트
 * @param props.children
 * @returns 최상위 html 문서 엘리먼트
 */
const RootLayout = ({ children }: LayoutProps<"/">): JSX.Element => {
  return (
    <html
      lang="ko"
      className={`${pretendard.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex h-dvh flex-col overflow-hidden bg-slate-950 text-slate-100">
        {children}
      </body>
    </html>
  );
};

export default RootLayout;
