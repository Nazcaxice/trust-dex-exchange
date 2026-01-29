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
  bsc,        // ✅ เพิ่ม BSC Mainnet (Chain ID 56)
  bscTestnet, // ✅ เพิ่ม BSC Testnet (Chain ID 97)
} from 'wagmi/chains';
import {
  QueryClientProvider,
  QueryClient,
} from "@tanstack/react-query";

const config = getDefaultConfig({
  appName: 'TrustDEX Pro',
  projectId: '4276f1754fa1cba468df7b87adb48b35', 
  // ✅ กำหนดให้เหลือแค่ BSC Testnet และ BSC Mainnet เท่านั้น
  chains: [bsc,bscTestnet], 
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider 
            // ✅ บังคับให้เริ่มที่ BSC Testnet (เพื่อให้ตรงกับค่าใน page.tsx ที่คุณตั้งเป็น 97)
            // หากต้องการใช้ Mainnet ให้เปลี่ยนเป็น initialChain={bsc}
            initialChain={bsc} 
            theme={darkTheme({
                accentColor: '#facc15', // เปลี่ยนสี Theme ให้เข้ากับ BNB (สีเหลือง)
                accentColorForeground: 'black',
                borderRadius: 'medium',
            })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}