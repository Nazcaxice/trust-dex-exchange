'use client';

import React, { useState, useEffect, useRef } from 'react';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { 
  ChevronDown, Activity, ShieldCheck, 
  Globe, Lock, Server, ArrowRightLeft, X, Loader2, Wallet ,
  Heart, Search, Filter, Zap, LayoutGrid ,Menu,
  Droplets, TrendingUp, Plus
} from 'lucide-react';


// ------------------------------------------------------------------
// 1. ตั้งค่า Smart Contract (เอา Address จาก Remix มาใส่ตรงนี้!)
// ------------------------------------------------------------------
 

// ABI คือคู่มือเพื่อให้เว็บคุยกับ Smart Contract รู้เรื่อง (อันนี้ตรงกับโค้ด Solidity ที่ให้ไป)
const CONTRACT_ABI = [
  { "inputs": [], "name": "stake", "outputs": [], "stateMutability": "payable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_amount", "type": "uint256" }], "name": "withdraw", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "name": "totalStaked", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "balances", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }
];
const DEX_ABI = [
    { "inputs": [], "name": "buy", "outputs": [], "stateMutability": "payable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "_amount", "type": "uint256" }], "name": "sell", "outputs": [], "stateMutability": "nonpayable", "type": "function" }
];

const MARKET_ABI = [
    { "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "buyNFT", "outputs": [], "stateMutability": "payable", "type": "function" }
];

// --- Widget กราฟ TradingView ---
const TradingViewWidget = () => {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (container.current && container.current.querySelector("script")) return;
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = `{"autosize": true,"symbol": "BINANCE:BTCUSDT","interval": "D","timezone": "Etc/UTC","theme": "light","style": "1","locale": "en","enable_publishing": false,"hide_top_toolbar": false,"hide_legend": false,"save_image": false,"calendar": false,"hide_volume": true,"support_host": "https://www.tradingview.com"}`;
    if (container.current) container.current.appendChild(script);
  }, []);
  return <div className="h-full w-full" ref={container} />;
};

// --- ส่วนหน้า Swap (คงเดิมไว้) ---
 const SwapSection = () => {
  const { address, isConnected } = useAccount();
  const [payAmount, setPayAmount] = useState('');
  const [isBuy, setIsBuy] = useState(true); // True = Buy TRUST, False = Sell TRUST

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const handleSwap = () => {
      if (!payAmount) return;
      if (isBuy) {
          // ซื้อ: จ่าย ETH -> เรียกฟังก์ชัน buy()
          writeContract({
              address: DEX_ADDRESS,
              abi: DEX_ABI,
              functionName: 'buy',
              value: parseEther(payAmount)
          });
      } else {
          // ขาย: จ่าย TRUST -> ต้อง Approve ก่อน (ใน Code ตัวอย่างนี้ข้าม Approve เพื่อความง่าย หรือ user ต้องไป approve เองใน etherscan)
          // *หมายเหตุ: การขาย Token (ERC20) ต้องทำ 2 step (Approve -> Sell) 
          // เพื่อไม่ให้ซับซ้อนเกินไปในตอนนี้ เราทำแค่ "ซื้อ" ก่อนนะครับ
          alert("For selling, you need to Approve first. Let's focus on BUYING for this step.");
      }
  };

  return (
    <div className="grid grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Left Side: Chart (คงเดิม) */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-lg">₿</div>
                    <div><div className="font-bold text-xl text-[#0f172a]">BTC/USDT</div><div className="text-sm text-slate-500">Bitcoin Price</div></div>
                </div>
                <div className="text-right"><div className="text-green-600 font-bold text-3xl">42,150.00</div><div className="text-xs text-slate-500 font-medium animate-pulse">● Live Data</div></div>
            </div>
            <div className="bg-white h-[500px] rounded-2xl shadow-sm border border-slate-200 p-1 relative overflow-hidden"><TradingViewWidget /></div>
        </div>

        {/* Right Side: Real Swap Box */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-xl border border-blue-100 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
                <div className="flex justify-between items-center mb-6"><h2 className="font-bold text-lg text-[#0f172a]">Swap Token</h2></div>

                {/* Input Pay */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 hover:border-blue-300 transition-colors group">
                    <div className="flex justify-between text-xs text-slate-500 mb-2"><span>You Pay</span></div>
                    <div className="flex justify-between items-center">
                        <input type="number" value={payAmount} onChange={(e)=>setPayAmount(e.target.value)} placeholder="0.0" className="bg-transparent text-2xl font-bold text-[#0f172a] w-full outline-none" />
                        <button className="flex items-center gap-2 bg-white border border-slate-200 px-2 py-1 rounded-full shadow-sm text-sm font-bold text-[#0f172a]">
                            <div className="w-5 h-5 bg-indigo-500 rounded-full"></div> ETH
                        </button>
                    </div>
                </div>

                <div className="flex justify-center -my-3 relative z-10">
                    <div className="bg-white border-2 border-slate-100 p-1.5 rounded-lg text-blue-600 shadow-sm cursor-pointer hover:scale-110 transition-transform"><ArrowRightLeft size={16} /></div>
                </div>

                {/* Input Receive */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 hover:border-blue-300 transition-colors group">
                    <div className="flex justify-between text-xs text-slate-500 mb-2"><span>You Receive</span></div>
                    <div className="flex justify-between items-center">
                        {/* คำนวณ x1000 ให้เห็น */}
                        <input type="text" readOnly value={payAmount ? parseFloat(payAmount) * 1000 : '0.0'} className="bg-transparent text-2xl font-bold text-[#0f172a] w-full outline-none" />
                        <button className="flex items-center gap-2 bg-white border border-slate-200 px-2 py-1 rounded-full shadow-sm text-sm font-bold text-[#0f172a]">
                            <div className="w-5 h-5 bg-blue-500 rounded-full"></div> TRUST
                        </button>
                    </div>
                </div>

                <div className="mt-6">
                     {!isConnected ? (
                        <div className="w-full bg-slate-200 text-slate-500 font-bold py-4 rounded-xl text-center">Connect Wallet First</div>
                    ) : (
                        <button onClick={handleSwap} disabled={isPending || isConfirming || !payAmount} 
                            className="w-full bg-[#0f172a] hover:bg-[#1e293b] text-white font-bold py-4 rounded-xl shadow-lg active:scale-95 disabled:opacity-50">
                            {isPending || isConfirming ? "Swapping..." : "Swap ETH to TRUST"}
                        </button>
                    )}
                </div>
                {isConfirmed && <div className="mt-2 text-center text-green-600 text-sm font-bold">✅ Swap Success! Check your wallet.</div>}
            </div>
        </div>
    </div>
  );
};

// --- 2. ส่วนหน้า Staking (อัปเกรดใหม่!) ---
 // 1. เพิ่ม Address ของเหรียญ TrustCoin ที่เพิ่ง Deploy
const TOKEN_ADDRESS = "0x914A685eC50496e41f6a508F9E481aacCEE4cC7a"; // <--- ใส่ Address เหรียญ TrustCoin (Addr_A)
// 2. แก้ Address นี้เป็นของ StakingV2 (Addr_B)
const CONTRACT_ADDRESS = "0x63F816Ab75938a05c01fCeAf3483F3928A85ea49"; 

const DEX_ADDRESS = "0xd0766B51267368be357909604F490a46808509A2"; // <--- ใส่ Address ของ DEX (0xCCC...)

const NFT_ADDRESS = "0x68A8a19bfe99D97aCF87f0180D6805a732dAaE0C";   // <--- ใส่ NFT_ADDR
const MARKET_ADDRESS = "0xceA35d9a35dF99c55A8375AC92B279F70A1A49D5"; // <--- ใส่ MARKET_ADDR
// ABI สำหรับอ่านยอดเหรียญ ERC20
const TOKEN_ABI = [
  { "inputs": [{ "internalType": "address", "name": "account", "type": "address" }], "name": "balanceOf", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }
];

// ... (ส่วนอื่นๆ เหมือนเดิม) ...

const StakingSection = () => {
    const { address, isConnected } = useAccount();
    const [amount, setAmount] = useState('');
    const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');

    // อ่านข้อมูล Staking (เหมือนเดิม)
    const { data: totalStakedData, refetch: refetchTotal } = useReadContract({
        address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'totalStaked',
    });
    const { data: myBalanceData, refetch: refetchMyBalance } = useReadContract({
        address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'balances', args: [address],
    });

   
    // เพิ่มฟังก์ชัน approve ใน TOKEN_ABI เดิม
    const TOKEN_ABI_EXTENDED = [
        ...TOKEN_ABI,
        { "inputs": [{ "internalType": "address", "name": "spender", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "approve", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "nonpayable", "type": "function" }
    ];

    // 🌟 อ่านข้อมูลเหรียญรางวัล (TRUST Coin)
    const { data: tokenBalance, refetch: refetchToken } = useReadContract({
        address: TOKEN_ADDRESS,
        abi: TOKEN_ABI,
        functionName: 'balanceOf',
        args: [address],
    });

    const { writeContract, data: hash, isPending } = useWriteContract();
    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

    useEffect(() => {
        if (isConfirmed) {
            refetchTotal();
            refetchMyBalance();
            refetchToken(); // รีเฟรชยอดเหรียญด้วย
            setAmount('');
        }
    }, [isConfirmed]);

    const handleAction = () => {
        if (!amount) return;
        if (mode === 'deposit') {
            writeContract({
                address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'stake', value: parseEther(amount)
            });
        } else {
            writeContract({
                address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'withdraw', args: [parseEther(amount)]
            });
        }
    }

    return (
        <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-10">
                <h2 className="text-3xl font-bold text-[#0f172a] mb-2">Staking V2 + Rewards</h2>
                <p className="text-slate-500">Stake ETH to earn <span className="font-bold text-blue-600">TrustCoin (TRUST)</span> instantly!</p>
            </div>

            {/* แสดงยอดเหรียญรางวัล */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 shadow-lg text-white mb-8 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl backdrop-blur-sm">💎</div>
                    <div>
                        <div className="text-blue-100 text-sm font-medium">Your Rewards</div>
                        <div className="text-3xl font-bold">
                            {tokenBalance ? formatEther(tokenBalance as bigint) : '0'} <span className="text-lg opacity-80">TRUST</span>
                        </div>
                    </div>
                </div>
                <div className="text-right hidden md:block">
                    <div className="text-xs bg-white/20 px-3 py-1 rounded-full inline-block mb-1">Rate: 1 ETH = 1,000 TRUST</div>
                    <div className="text-blue-200 text-xs">Contract: {TOKEN_ADDRESS.slice(0,6)}...{TOKEN_ADDRESS.slice(-4)}</div>
                </div>
            </div>

            {/* ส่วน Status และ Form เหมือนเดิม */}
            {hash && (
                <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-xl text-center text-sm">
                     Transaction Hash: {hash.slice(0, 10)}... {isConfirming && "Processing..."} {isConfirmed && "✅ Success!"}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Stats Card */}
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-indigo-600/30">Ξ</div>
                        <div><div className="font-bold text-xl text-[#0f172a]">Ethereum Vault</div><div className="text-xs text-slate-400">Sepolia Network</div></div>
                    </div>
                    <div className="space-y-6">
                         <div className="bg-slate-50 p-4 rounded-xl">
                            <div className="text-sm text-slate-500 mb-1">Total Value Locked</div>
                            <div className="text-2xl font-bold text-[#0f172a]">{totalStakedData ? formatEther(totalStakedData as bigint) : '0'} ETH</div>
                        </div>
                        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                            <div className="text-sm text-indigo-600 mb-1">Your Staked Balance</div>
                            <div className="text-2xl font-bold text-indigo-900">{myBalanceData ? formatEther(myBalanceData as bigint) : '0'} ETH</div>
                        </div>
                    </div>
                </div>

                {/* Action Card */}
                <div className="bg-white rounded-2xl p-6 shadow-xl border border-blue-100 relative overflow-hidden flex flex-col">
                    <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
                        <button onClick={() => setMode('deposit')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'deposit' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Deposit</button>
                        <button onClick={() => setMode('withdraw')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'withdraw' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500'}`}>Withdraw</button>
                    </div>

                    <h3 className="font-bold text-lg text-[#0f172a] mb-4">{mode === 'deposit' ? 'Stake ETH & Get Reward' : 'Unstake ETH'}</h3>
                    
                    {!isConnected ? (
                        <div className="text-center py-8 text-slate-400">Please Connect Wallet</div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-slate-500 font-bold ml-1">AMOUNT</label>
                                <div className="flex items-center mt-1">
                                    <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-[#0f172a] outline-none" />
                                    <span className="ml-3 font-bold text-slate-400">ETH</span>
                                </div>
                            </div>
                            <button onClick={handleAction} disabled={isPending || isConfirming || !amount} className={`w-full py-4 rounded-xl font-bold text-white transition-all shadow-lg active:scale-95 ${mode === 'deposit' ? 'bg-indigo-600' : 'bg-orange-500'} ${(isPending||isConfirming) && 'opacity-50'}`}>
                                {isPending || isConfirming ? "Processing..." : (mode === 'deposit' ? 'Stake & Claim TRUST' : 'Withdraw')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

 // อย่าลืมเพิ่ม imports ไอคอนพวกนี้ด้านบนไฟล์ด้วยนะครับ
// import { Heart, Search, Filter, Zap, LayoutGrid } from 'lucide-react';

const MarketplaceSection = () => {
    const { isConnected } = useAccount();
    const { writeContract, data: hash, isPending } = useWriteContract();
    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

    // Mock Data ที่ดูสมจริงขึ้น
    const items = [
        { id: 2, name: "Cyber Punk #001", price: "0.001", likes: 120, img: "https://test.onenarai.com/data/files/admin_pro/goods_4/1759585968.jpg" },
        { id: 3, name: "Golden Ape #02", price: "0.005", likes: 85, img: "https://test.onenarai.com/data/files/admin_pro/goods_1/1759582463.jpg" },
        { id: 4, name: "Trust Badge Legacy", price: "0.01", likes: 342, img: "https://onenarai.com/data/files/admin_pro/goods_25/1765764022.jpg" },
        { id: 5, name: "Neon Walker", price: "0.008", likes: 45, img: "https://robohash.org/trust4?set=set4&bgset=bg2" },
        { id: 6, name: "Blue Soul", price: "0.015", likes: 210, img: "https://robohash.org/trust5?set=set4&bgset=bg2" },
        { id: 7, name: "Crypto Samurai", price: "0.02", likes: 99, img: "https://robohash.org/trust6?set=set4&bgset=bg2" },
    ];

    const handleBuy = (tokenId: number, price: string) => {
        if(!isConnected) return;
        writeContract({
            address: MARKET_ADDRESS,
            abi: MARKET_ABI,
            functionName: 'buyNFT',
            args: [BigInt(tokenId)],
            value: parseEther(price)
        });
    }

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            
            {/* 1. Hero Banner: หัวข้อสวยๆ */}
            <div className="relative bg-[#0f172a] rounded-3xl p-10 mb-10 overflow-hidden text-center shadow-2xl">
                <div className="absolute top-0 left-0 w-full h-full opacity-30 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500 rounded-full blur-3xl opacity-20"></div>
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500 rounded-full blur-3xl opacity-20"></div>
                
                <div className="relative z-10">
                    <span className="bg-blue-900/50 text-blue-300 px-3 py-1 rounded-full text-xs font-bold border border-blue-700/50 mb-4 inline-block">
                        ✨ New Collection Dropped
                    </span>
                    <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight">
                        Discover <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Rare Digital Art</span>
                    </h2>
                    <p className="text-slate-400 max-w-xl mx-auto mb-8">
                        The world's most trusted NFT marketplace. Collect, buy, and sell exclusive digital assets secured by Ethereum.
                    </p>
                    <div className="flex justify-center gap-4">
                        <button className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20 active:scale-95">Explore Now</button>
                        <button className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl font-bold transition-all border border-slate-700">Create NFT</button>
                    </div>
                </div>
            </div>

            {/* 2. Filter Bar: แถบค้นหา */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8 sticky top-20 z-30 bg-[#f8fafc]/80 backdrop-blur-md py-4">
                <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto">
                    {['All Items', 'Art', 'Gaming', 'PFP', 'Photography'].map((tab, i) => (
                        <button key={tab} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${i === 0 ? 'bg-[#0f172a] text-white shadow-lg' : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'}`}>
                            {tab}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input type="text" placeholder="Search items..." className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all" />
                    </div>
                    <button className="p-2 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-[#0f172a] hover:border-slate-300"><Filter size={20}/></button>
                    <button className="p-2 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-[#0f172a] hover:border-slate-300"><LayoutGrid size={20}/></button>
                </div>
            </div>

            {/* Notification */}
            {hash && (
                <div className="max-w-md mx-auto mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-center text-sm shadow-sm flex items-center justify-center gap-2">
                     <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                     {isConfirming ? "Confirming on Blockchain..." : "🎉 NFT Purchased Successfully!"}
                </div>
            )}

            {/* 3. Product Grid: การ์ดสินค้าสวยๆ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {items.map((item) => (
                    <div key={item.id} className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group cursor-pointer relative">
                        
                        {/* Image Container */}
                        <div className="relative h-64 rounded-xl overflow-hidden mb-4">
                            <img src={item.img} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                            
                            {/* Like Button */}
                            <button className="absolute top-3 right-3 bg-white/20 backdrop-blur-md text-white p-2 rounded-full hover:bg-red-500/80 hover:text-white transition-colors group/heart">
                                <Heart size={18} className="group-hover/heart:fill-current" />
                            </button>
                            
                            {/* Buy Button Overlay (Show on Hover) */}
                             
                        </div>

                        {/* Content */}
                        <div className="px-2 pb-2">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h3 className="font-bold text-lg text-[#0f172a] group-hover:text-blue-600 transition-colors">{item.name}</h3>
                                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                                        <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-blue-400 to-purple-400"></div>
                                        <span>TrustDEX Admin</span>
                                        <ShieldCheck size={12} className="text-blue-500" />
                                    </div>
                                </div>
                                <div className="text-xs text-slate-400 flex items-center gap-1">
                                    <Heart size={12} className="fill-slate-300 text-slate-300" /> {item.likes}
                                </div>
                            </div>
                            
                            <div className="border-t border-slate-100 pt-3 mt-3 flex justify-between items-center">
                                <div className="text-xs text-slate-400">Current Price</div>
                                <div className="flex items-center gap-1">
                                    <div className="w-4 h-4 bg-slate-800 rounded-full flex items-center justify-center text-[10px] text-white">Ξ</div>
                                    <span className="font-bold text-lg text-[#0f172a]">{item.price} ETH</span>
                                </div>
                            </div>
                        </div>
                        <div className="px-2 pb-2">
                             <button 
                                    onClick={(e) => {
                                        e.stopPropagation(); // กันไม่ให้กดโดนการ์ด
                                        handleBuy(item.id, item.price);
                                    }}
                                    disabled={isPending || isConfirming}
                                    className="w-full bg-white/90 backdrop-blur text-[#0f172a] font-bold py-3 rounded-xl shadow-lg hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-2"
                                >
                                    <Zap size={18} fill="currentColor" /> {isPending ? 'Processing...' : 'Buy Now'}
                                </button>
                        </div>   
                    </div>
                ))}
            </div>
        </div>
    );
};

 
// --- 4. ส่วนหน้า Liquidity Pools (ใหม่!) ---
const PoolsSection = () => {
    const { isConnected } = useAccount();
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [amountA, setAmountA] = useState('');
    const [amountB, setAmountB] = useState('');

    // Mock Data สำหรับ Pools
    const pools = [
        { id: 1, pair: "ETH - TRUST", tokenA: "ETH", tokenB: "TRUST", apr: "125.4%", tvl: "2.4M", multiplier: "40x", color: "from-blue-500 to-indigo-600" },
        { id: 2, pair: "USDT - TRUST", tokenA: "USDT", tokenB: "TRUST", apr: "85.2%", tvl: "5.1M", multiplier: "25x", color: "from-green-500 to-emerald-600" },
        { id: 3, pair: "ETH - USDT", tokenA: "ETH", tokenB: "USDT", apr: "15.8%", tvl: "120M", multiplier: "5x", color: "from-slate-500 to-slate-700" },
    ];

    // จำลองการคำนวณ Price Impact / Ratio
    const handleAmountChange = (val: string, type: 'A' | 'B') => {
        if (type === 'A') {
            setAmountA(val);
            // สมมติ ratio 1:1000
            setAmountB(val ? (parseFloat(val) * 1000).toString() : '');
        } else {
            setAmountB(val);
            setAmountA(val ? (parseFloat(val) / 1000).toString() : '');
        }
    };

    const { writeContract, isPending } = useWriteContract();

    const handleAddLiquidity = () => {
        if (!isConnected) return;
        // ตรงนี้ต้องใส่ ABI ของ Router Contract (เช่น Uniswap Router)
        // function addLiquidityETH(...)
        alert(`Adding Liquidity: ${amountA} ${pools.find(p => p.id === expandedId)?.tokenA} + ${amountB} ${pools.find(p => p.id === expandedId)?.tokenB}`);
    };

    return (
        <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            {/* Header Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] rounded-2xl p-6 text-white shadow-xl">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-500/20 rounded-lg"><Droplets size={20} className="text-blue-400" /></div>
                        <span className="text-slate-400 text-sm font-medium">Total Value Locked</span>
                    </div>
                    <div className="text-3xl font-bold">$124,500,230</div>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-green-500/10 rounded-lg"><TrendingUp size={20} className="text-green-600" /></div>
                        <span className="text-slate-500 text-sm font-medium">24h Volume</span>
                    </div>
                    <div className="text-3xl font-bold text-[#0f172a]">$4,200,500</div>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center">
                    <div className="text-sm text-slate-500 mb-1">Your Active Liquidity</div>
                    <div className="text-2xl font-bold text-indigo-600">$0.00</div>
                    <div className="text-xs text-slate-400">No active positions</div>
                </div>
            </div>

            <h2 className="text-2xl font-bold text-[#0f172a] mb-6 flex items-center gap-2">
                Top Liquidity Pools <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">Earn Fees</span>
            </h2>

            {/* Pools List */}
            <div className="space-y-4">
                {pools.map((pool) => (
                    <div key={pool.id} className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden ${expandedId === pool.id ? 'border-blue-500 shadow-lg ring-1 ring-blue-200' : 'border-slate-200 hover:border-blue-300'}`}>
                        {/* Pool Header Row */}
                        <div 
                            className="p-6 cursor-pointer flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                            onClick={() => setExpandedId(expandedId === pool.id ? null : pool.id)}
                        >
                            <div className="flex items-center gap-4">
                                <div className="flex -space-x-2">
                                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${pool.color} border-2 border-white flex items-center justify-center text-white text-xs font-bold`}>{pool.tokenA[0]}</div>
                                    <div className={`w-10 h-10 rounded-full bg-slate-800 border-2 border-white flex items-center justify-center text-white text-xs font-bold`}>{pool.tokenB[0]}</div>
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-[#0f172a]">{pool.pair}</h3>
                                    <div className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded inline-block">Fee 0.3%</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end">
                                <div className="text-left md:text-right">
                                    <div className="text-xs text-slate-400">APR</div>
                                    <div className="font-bold text-green-600 flex items-center gap-1">
                                        <Zap size={12} fill="currentColor" /> {pool.apr}
                                    </div>
                                </div>
                                <div className="text-left md:text-right">
                                    <div className="text-xs text-slate-400">TVL</div>
                                    <div className="font-bold text-[#0f172a]">${pool.tvl}</div>
                                </div>
                                <div className={`transition-transform duration-300 ${expandedId === pool.id ? 'rotate-180' : ''}`}>
                                    <ChevronDown size={20} className="text-slate-400" />
                                </div>
                            </div>
                        </div>

                        {/* Expandable Section (Add Liquidity) */}
                        <div className={`bg-slate-50 border-t border-slate-100 transition-all duration-500 ease-in-out ${expandedId === pool.id ? 'max-h-[500px] opacity-100 p-6' : 'max-h-0 opacity-0 p-0 overflow-hidden'}`}>
                            <div className="flex flex-col md:flex-row gap-6 items-start">
                                <div className="flex-1 w-full space-y-4">
                                    <div className="flex justify-between text-sm font-bold text-[#0f172a]">
                                        <span>Add Liquidity</span>
                                        <span className="text-slate-400 font-normal">Balance: 0.00</span>
                                    </div>
                                    
                                    {/* Input Token A */}
                                    <div className="bg-white border border-slate-200 p-3 rounded-xl flex items-center justify-between">
                                        <input 
                                            type="number" 
                                            placeholder="0.0" 
                                            value={amountA}
                                            onChange={(e) => handleAmountChange(e.target.value, 'A')}
                                            className="w-full bg-transparent font-bold text-xl outline-none text-[#0f172a]" 
                                        />
                                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-sm font-bold ml-2">{pool.tokenA}</span>
                                    </div>

                                    <div className="flex justify-center text-slate-400"><Plus size={16} /></div>

                                    {/* Input Token B */}
                                    <div className="bg-white border border-slate-200 p-3 rounded-xl flex items-center justify-between">
                                        <input 
                                            type="number" 
                                            placeholder="0.0" 
                                            value={amountB}
                                            onChange={(e) => handleAmountChange(e.target.value, 'B')}
                                            className="w-full bg-transparent font-bold text-xl outline-none text-[#0f172a]" 
                                        />
                                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-sm font-bold ml-2">{pool.tokenB}</span>
                                    </div>

                                    {!isConnected ? (
                                        <button className="w-full bg-slate-200 text-slate-500 font-bold py-3 rounded-xl cursor-not-allowed">Connect Wallet First</button>
                                    ) : (
                                        <button 
                                            onClick={handleAddLiquidity}
                                            disabled={!amountA || !amountB}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
                                        >
                                            {isPending ? 'Processing...' : 'Add Liquidity'}
                                        </button>
                                    )}
                                </div>

                                {/* Info / Rewards Box */}
                                <div className="w-full md:w-64 bg-indigo-50 border border-indigo-100 p-4 rounded-xl">
                                    <h4 className="font-bold text-indigo-900 mb-2 text-sm">Position Summary</h4>
                                    <ul className="space-y-2 text-sm text-indigo-800/80">
                                        <li className="flex justify-between"><span>Share of Pool:</span> <span className="font-bold">{'< 0.01%'}</span></li>
                                        <li className="flex justify-between"><span>Est. APR:</span> <span className="font-bold text-green-600">{pool.apr}</span></li>
                                        <li className="flex justify-between"><span>Multiplier:</span> <span className="font-bold text-orange-500">{pool.multiplier}</span></li>
                                    </ul>
                                    <div className="mt-4 pt-3 border-t border-indigo-200 text-xs text-indigo-600">
                                        💡 By adding liquidity, you'll earn 0.25% of all trades on this pair proportional to your share.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
export default function CryptoExchange() {
  const [activeMenu, setActiveMenu] = useState('Swap');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const renderContent = () => {
    switch (activeMenu) {
      case 'Swap': return <SwapSection />;
      case 'Marketplace': return <MarketplaceSection />;
      case 'Staking': return <StakingSection />;
      case 'Pools Liquidity': return <PoolsSection />;
      default: return <SwapSection />;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-900 pb-20">
       {/* --- Header (Updated for Mobile) --- */}
      <header className="bg-[#0f172a] text-white border-b border-slate-800 sticky top-0 z-50 shadow-md">
        <div className="container mx-auto px-4 h-16 flex justify-between items-center">
          
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={()=>setActiveMenu('Swap')}>
            <img src="img/logo200.png" alt="Logo" className="w-10 h-10 object-contain" />
            <span className="text-xl font-bold tracking-tight">Onenarai Exchange <span className="text-[10px] font-normal text-blue-300 bg-blue-900/50 px-1.5 py-0.5 rounded border border-blue-800 ml-1">PRO</span></span>
          </div>

          {/* Desktop Menu (ซ่อนในมือถือ) */}
          <nav className="hidden md:flex gap-1 text-sm font-medium text-slate-400">
            {['Swap', 'Marketplace', 'Staking', 'Pools Liquidity'].map((item) => (
              <button key={item} onClick={() => setActiveMenu(item)} className={`px-4 py-2 rounded-lg transition-all ${activeMenu === item ? 'bg-slate-800 text-white shadow-inner' : 'hover:text-white hover:bg-slate-800/50'}`}>{item}</button>
            ))}
          </nav>
          
          <div className="flex items-center gap-4">
              {/* ปุ่ม Connect (โชว์ตลอด แต่ในมือถือจอเล็กมากๆ อาจจะเบียดได้) */}
              <div className="scale-90 sm:scale-100">
                  <ConnectButton showBalance={false} chainStatus="icon" accountStatus="avatar" />
              </div>

              {/* Mobile Hamburger Button (โชว์เฉพาะมือถือ) */}
              <button 
                className="md:hidden text-slate-300 hover:text-white p-2"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown (ส่วนที่เพิ่มมาใหม่!) */}
        {isMobileMenuOpen && (
            <div className="md:hidden absolute top-16 left-0 w-full bg-[#0f172a] border-b border-slate-800 p-4 animate-in slide-in-from-top-5 shadow-2xl">
                <div className="flex flex-col gap-2">
                    {['Swap', 'Marketplace', 'Staking', 'Pools Liquidity'].map((item) => (
                        <button 
                            key={item} 
                            onClick={() => { setActiveMenu(item); setIsMobileMenuOpen(false); }}
                            className={`p-4 rounded-xl text-left font-bold transition-all flex justify-between items-center ${activeMenu === item ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                        >
                            {item}
                            {activeMenu === item && <div className="w-2 h-2 bg-white rounded-full"></div>}
                        </button>
                    ))}
                </div>
            </div>
        )}
      </header>
      <main className="container mx-auto px-4 py-8">{renderContent()}</main>
    </div>
  );
}