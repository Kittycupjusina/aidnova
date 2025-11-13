import "./globals.css";
import type { ReactNode } from "react";
import { Providers } from "@/app/providers";
import { WalletButton } from "@/components/WalletButton";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>
          <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 relative overflow-hidden">
            {/* 背景装饰 */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
              <div className="absolute top-60 -left-40 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}} />
              <div className="absolute bottom-20 right-1/3 w-72 h-72 bg-orange-500/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}} />
            </div>
            
            <nav className="relative z-20 backdrop-blur-md bg-gradient-to-r from-purple-900/30 via-pink-900/20 to-purple-900/30 border-b border-purple-500/20">
              <div className="mx-auto max-w-7xl px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 blur-xl opacity-50" />
                      <div className="relative h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center font-bold text-white shadow-lg">
                        AN
                      </div>
                    </div>
                    <div>
                      <h1 className="text-xl font-black gradient-text">AidNova</h1>
                      <p className="text-xs text-purple-300/70">Relief DAO Platform</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <a href="/donate" className="group relative px-6 py-2.5 font-semibold overflow-hidden rounded-full">
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 transition-transform group-hover:scale-105" />
                      <span className="relative text-white">💝 Donate</span>
                    </a>
                    <a href="/propose" className="px-6 py-2.5 rounded-full border border-purple-400/30 text-purple-200 font-semibold hover:bg-purple-500/10 transition-colors">
                      📋 Propose
                    </a>
                    <WalletButton />
                  </div>
                </div>
              </div>
            </nav>
            
            <main className="relative z-10 mx-auto max-w-7xl px-6 py-10">{children}</main>
            
            {/* 页脚装饰 */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
          </div>
        </Providers>
      </body>
    </html>
  );
}


