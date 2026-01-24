'use client';

import * as React from 'react';
import '@rainbow-me/rainbowkit/styles.css';
import {
  getDefaultConfig,
  RainbowKitProvider,
  darkTheme,
} from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import {
  mainnet,
  polygon,
  optimism,
  arbitrum,
  base,
  sepolia, // <--- 1. เพิ่มการ import ตรงนี้
  bscTestnet,// <--- 2. เพิ่มการ import ตรงนี้
} from 'wagmi/chains';
import {
  QueryClientProvider,
  QueryClient,
} from "@tanstack/react-query";

const config = getDefaultConfig({
  appName: 'TrustDEX Pro',
  projectId: '4276f1754fa1cba468df7b87adb48b35', 
  // 2. เพิ่ม sepolia เข้าไปในรายการ chains (เอาไว้หน้าสุดเพื่อให้เป็น default)
  chains: [bscTestnet,sepolia, mainnet, polygon, optimism, arbitrum, base],
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider 
            initialChain={sepolia} // 3. บังคับให้เริ่มที่ Sepolia
            theme={darkTheme({
                accentColor: '#2563eb',
                accentColorForeground: 'white',
                borderRadius: 'medium',
            })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}