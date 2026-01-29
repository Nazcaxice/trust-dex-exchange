'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
// แก้ไขบรรทัด import wagmi ให้เป็นแบบนี้
import { 
  useAccount, 
  useReadContract, 
  useReadContracts, // ✅ เพิ่มอันนี้
  useWriteContract, 
  usePublicClient, 
  useChainId, 
  useSwitchChain,
  useBalance // ✅ เพิ่มอันนี้
} from 'wagmi';
import { parseEther, formatEther, parseUnits, formatUnits, parseAbi } from 'viem';
import { 
  ChevronDown, ArrowRightLeft, X, Loader2, Wallet,
  Zap, LayoutGrid, Menu, Scale, Info, Image as ImageIcon, UploadCloud 
} from 'lucide-react';
import axios from 'axios';

// ==========================================
// 1. CONFIGURATION (BNB SMART CHAIN)
// ==========================================

// ✅ 1. กำหนด Chain ID เป็น BNB Chain (Testnet = 97, Mainnet = 56)
const TARGET_CHAIN_ID = 56; 
const TARGET_CHAIN_NAME = "BNB Smart Chain"; // BNB Smart Chain Testnet
const BLOCK_EXPLORER = "https://bscscan.com/tx/";  // https://testnet.bscscan.com/tx/

// ✅ 2. อัปเดตรายการเหรียญเป็น BSC (BEP-20)
// ⚠️ Address ด้านล่างเป็นตัวอย่างสำหรับ Testnet ต้องเปลี่ยนเป็น Address จริงของคุณ
const TOKENS: Record<string, { address: string; decimals: number; icon: string }> = {
    "BNB":      { address: "NATIVE", decimals: 18, icon: "🟡" }, // Native Token คือ BNB
    "USDT":     { address: "0x55d398326f99059ff775485246999027b3197955", decimals: 18, icon: "💵" },
    "JKP":      { address: "0x73A0d17f975A208d25A5154FF94664A34839F163", decimals: 18, icon: "🔸" },
    "JKPS":    { address: "0x93bA17729cCd7235162c78160bd851B082353119", decimals: 18, icon: "1️⃣" },
   
};

// ⚠️ ใส่ Address Contract ที่ Deploy บน BNB Chain แล้ว
const ROUTER_ADDRESS = "0xD99D1c33F9fC3444f8101754aBC46c52416550D1"; // PancakeSwap Router (Testnet)
const STAKING_ADDRESS = "0x...YOUR_BNB_STAKING_CONTRACT..."; 
const NFT_MARKET_ADDRESS = "0x...YOUR_BNB_MARKET_CONTRACT..."; 
const MINTABLE_NFT_ADDRESS = "0x...YOUR_BNB_NFT_CONTRACT..."; 

const PINATA_API_KEY = "cc4ebea4b0daa46075e0";
const PINATA_API_SECRET = "30db676b0f0973eb1ebc359e9ab5c7ea64228cde683046415d4bd5937fb019cc";

// ABIs
const ERC20_ABI = parseAbi([
    "function balanceOf(address owner) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)"
]);

const ROUTER_ABI = [
    { "inputs": [{ "internalType": "uint256", "name": "amountOutMin", "type": "uint256" }, { "internalType": "address[]", "name": "path", "type": "address[]" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }], "name": "swapExactETHForTokens", "outputs": [], "stateMutability": "payable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "amountIn", "type": "uint256" }, { "internalType": "uint256", "name": "amountOutMin", "type": "uint256" }, { "internalType": "address[]", "name": "path", "type": "address[]" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }], "name": "swapExactTokensForTokens", "outputs": [], "stateMutability": "nonpayable", "type": "function" }
];

const MINTABLE_NFT_ABI = [
    "function mintItem(address recipient, string memory tokenURI) public returns (uint256)",
    "function approve(address to, uint256 tokenId) public",
    "function tokenURI(uint256 tokenId) public view returns (string memory)", 
    "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
];

const convertIpfsToHttp = (uri: string) => {
    if (!uri) return "";
    if (uri.startsWith('ipfs://')) { return uri.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/'); }
    return uri; 
};

// ==========================================
// 2. COMPONENTS
// ==========================================

const TradingViewWidget = () => {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (container.current && !container.current.querySelector("script")) {
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
      script.type = "text/javascript";
      script.async = true;
      // ✅ เปลี่ยนเป็น BNBUSDT
      script.innerHTML = `{"autosize": true,"symbol": "BINANCE:BNBUSDT","interval": "D","timezone": "Etc/UTC","theme": "light","style": "1","locale": "en","enable_publishing": false,"hide_top_toolbar": false,"hide_legend": false,"save_image": false,"calendar": false,"hide_volume": true,"support_host": "https://www.tradingview.com"}`;
      container.current.appendChild(script);
    }
  }, []);
  return <div className="h-full w-full" ref={container} />;
};

// --- SWAP SECTION ---
// --- SWAP SECTION (เปลี่ยนเป็น My Wallet Assets) ---
const SwapSection = () => {
    const { address, isConnected } = useAccount();
    const chainId = useChainId();
    const { switchChain } = useSwitchChain();

    // 1. ดึงยอด BNB (Native Token)
    const { data: bnbBalance, isLoading: isBnbLoading } = useBalance({
        address: address,
    });

    // 2. รายชื่อ Token ที่ต้องการแสดง (ไม่รวม BNB เพราะดึงแยก)
    const targetTokens = ["USDT", "JKP", "JKPS"];

    // 3. ดึงยอด Token ทั้งหมดในครั้งเดียว (Multicall)
    const { data: tokenBalances, isLoading: isTokenLoading } = useReadContracts({
        contracts: targetTokens.map((symbol) => ({
            address: TOKENS[symbol].address as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [address],
        })),
        query: {
            enabled: isConnected && !!address, // ดึงข้อมูลเมื่อต่อกระเป๋าแล้วเท่านั้น
            refetchInterval: 5000, // อัปเดตทุก 5 วินาที
        }
    });

    // ฟังก์ชันช่วยจัดรูปแบบตัวเลข
    const formatValue = (value: bigint | undefined, decimals: number) => {
        if (!value) return "0.00";
        // ตัดทศนิยมเหลือ 4 ตำแหน่งและใส่ลูกน้ำ
        return parseFloat(formatUnits(value, decimals)).toLocaleString(undefined, { 
            minimumFractionDigits: 2,
            maximumFractionDigits: 4 
        });
    };

    // ตรวจสอบ Network
    const isWrongNetwork = isConnected && chainId !== TARGET_CHAIN_ID;

    return (
        <div className="grid grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* ฝั่งซ้าย: กราฟ TradingView (คงเดิม) */}
            <div className="col-span-12 lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 p-1 min-h-[500px]">
                <TradingViewWidget />
            </div>

            {/* ฝั่งขวา: แสดงยอดเงิน (แก้ไขใหม่) */}
            <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-xl border border-blue-100 relative overflow-hidden">
                    {/* Header Card */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-purple-500"></div>
                    <h2 className="font-bold text-xl text-[#0f172a] mb-6 flex items-center gap-2">
                        <Wallet className="text-blue-600" /> My Assets
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100 font-normal">
                            BSC Testnet
                        </span>
                    </h2>

                    {!isConnected ? (
                        <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center">
                            <div className="bg-slate-100 p-4 rounded-full text-slate-400">
                                <Wallet size={48} />
                            </div>
                            <p className="text-slate-500">Connect wallet to view your balances</p>
                            <ConnectButton />
                        </div>
                    ) : isWrongNetwork ? (
                        <div className="text-center py-10 space-y-4">
                            <div className="text-red-500 font-bold">Wrong Network</div>
                            <button 
                                onClick={() => switchChain({ chainId: TARGET_CHAIN_ID })}
                                className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
                            >
                                Switch to BSC Testnet
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* 1. แสดง BNB (Native) */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center transition-all hover:shadow-md hover:border-yellow-300">
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl bg-white rounded-full p-1 shadow-sm">
                                        {TOKENS["BNB"].icon}
                                    </span>
                                    <div>
                                        <div className="font-bold text-slate-800">BNB</div>
                                        <div className="text-xs text-slate-500">Native Token</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-lg font-extrabold text-slate-900">
                                        {isBnbLoading ? <Loader2 className="animate-spin h-5 w-5 text-slate-400" /> : 
                                         bnbBalance ? parseFloat(formatEther(bnbBalance.value)).toLocaleString(undefined, {maximumFractionDigits: 4}) : "0.00"}
                                    </div>
                                </div>
                            </div>

                            {/* 2. แสดง Token อื่นๆ (USDT, JKP, JKPS) */}
                            {targetTokens.map((symbol, index) => {
                                const balanceData = tokenBalances?.[index];
                                const rawBalance = balanceData?.result as bigint | undefined;
                                const isLoading = isTokenLoading;

                                return (
                                    <div key={symbol} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center transition-all hover:shadow-md hover:border-blue-300">
                                        <div className="flex items-center gap-3">
                                            <span className="text-3xl bg-white rounded-full p-1 shadow-sm">
                                                {TOKENS[symbol].icon}
                                            </span>
                                            <div>
                                                <div className="font-bold text-slate-800">{symbol}</div>
                                                <div className="text-xs text-slate-500">BEP-20</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-lg font-extrabold text-slate-900">
                                                {isLoading ? <Loader2 className="animate-spin h-5 w-5 text-slate-400" /> : 
                                                 formatValue(rawBalance, TOKENS[symbol].decimals)}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    
                    {/* Footer Actions */}
                    {isConnected && !isWrongNetwork && (
                        <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3">
                            <button className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 transition-all active:scale-95">
                                <Zap size={18} /> Deposit
                            </button>
                            <button className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all active:scale-95">
                                <ArrowRightLeft size={18} /> Transfer
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- MARKETPLACE SECTION ---
const MarketplaceSection = () => {
    const { address, isConnected } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();
    const chainId = useChainId();
    const { switchChain } = useSwitchChain();

    const [viewMode, setViewMode] = useState<'BROWSE' | 'SELL'>('BROWSE');
    const [itemName, setItemName] = useState("");
    const [itemDescription, setItemDescription] = useState("");
    const [itemWeight, setItemWeight] = useState(""); 
    const [sellPrice, setSellPrice] = useState("");
    const [sellCurrency, setSellCurrency] = useState("ADS");
    const [itemImageFile, setItemImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [status, setStatus] = useState(""); 
    const [isLoading, setIsLoading] = useState(false);
    const [listings, setListings] = useState<any[]>([]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setItemImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const uploadImageToIPFS = async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;
        const response = await axios.post(url, formData, {
            headers: { 'pinata_api_key': PINATA_API_KEY, 'pinata_secret_api_key': PINATA_API_SECRET, 'Content-Type': 'multipart/form-data' }
        });
        return `ipfs://${response.data.IpfsHash}`;
    };

    const uploadMetadataToIPFS = async (imageUrl: string) => {
        const metadata = { name: itemName, description: itemDescription, image: imageUrl, attributes: [{ trait_type: "Weight", value: itemWeight }, { trait_type: "Created By", value: address }] };
        const url = `https://api.pinata.cloud/pinning/pinJSONToIPFS`;
        const response = await axios.post(url, metadata, { headers: { 'pinata_api_key': PINATA_API_KEY, 'pinata_secret_api_key': PINATA_API_SECRET } });
        return `ipfs://${response.data.IpfsHash}`;
    };

    const handleMintAndList = async () => {
        if (!publicClient) return;
        if (!isConnected || !itemName || !sellPrice || !itemImageFile) { alert("Please fill all details."); return; }
        
        // ✅ บังคับ Network
        if (chainId !== TARGET_CHAIN_ID) {
            switchChain({ chainId: TARGET_CHAIN_ID });
            return;
        }

        setIsLoading(true);
        try {
            setStatus("1/4 Uploading Image...");
            const imageURI = await uploadImageToIPFS(itemImageFile);
            setStatus("2/4 Uploading Metadata...");
            const tokenURI = await uploadMetadataToIPFS(imageURI);

            setStatus("3/4 Minting NFT on BNB Chain...");
            const mintTxHash = await writeContractAsync({
                address: MINTABLE_NFT_ADDRESS as `0x${string}`,
                abi: parseAbi(MINTABLE_NFT_ABI),
                functionName: 'mintItem',
                args: [address as `0x${string}`, tokenURI]
            });
            setStatus("Waiting for Mint confirmation...");
            const receipt = await publicClient.waitForTransactionReceipt({ hash: mintTxHash });
            const transferLog = receipt.logs.find(log => log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef');
            const newTokenId = parseInt(transferLog?.topics[3] || "0", 16);

            setStatus("4/4 Approving Marketplace...");
            const approveTxHash = await writeContractAsync({
                address: MINTABLE_NFT_ADDRESS as `0x${string}`,
                abi: parseAbi(MINTABLE_NFT_ABI),
                functionName: 'approve',
                args: [NFT_MARKET_ADDRESS as `0x${string}`, BigInt(newTokenId)]
            });
            await publicClient.waitForTransactionReceipt({ hash: approveTxHash });

            setStatus("Listing Item...");
            const tokenConfig = TOKENS[sellCurrency];
            const priceWei = parseUnits(sellPrice, tokenConfig.decimals);
            const paymentTokenAddr = tokenConfig.address === "NATIVE" ? "0x0000000000000000000000000000000000000000" : tokenConfig.address;

            await writeContractAsync({
                address: NFT_MARKET_ADDRESS as `0x${string}`,
                abi: [{ "inputs": [{ "internalType": "address", "name": "_nftContract", "type": "address" }, { "internalType": "uint256", "name": "_tokenId", "type": "uint256" }, { "internalType": "address", "name": "_paymentToken", "type": "address" }, { "internalType": "uint256", "name": "_price", "type": "uint256" }], "name": "listNFT", "outputs": [], "stateMutability": "nonpayable", "type": "function" }],
                functionName: 'listNFT',
                args: [MINTABLE_NFT_ADDRESS as `0x${string}`, BigInt(newTokenId), paymentTokenAddr as `0x${string}`, priceWei]
            });

            alert(`✅ Listed "${itemName}" on BNB Chain!`);
            setItemName(""); setItemImageFile(null); setImagePreview(null); setStatus(""); fetchListings();
        } catch (error) { console.error(error); alert("❌ Error"); } finally { setIsLoading(false); }
    };
    
    const fetchListings = async () => {
        if (!publicClient) return;
        try {
            const countResult = await publicClient.readContract({
                address: NFT_MARKET_ADDRESS as `0x${string}`,
                abi: [ { "inputs": [], "name": "getListingsCount", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" } ],
                functionName: 'getListingsCount',
            });
            const count = Number(countResult);
            const loadedItems = [];

            for (let i = 0; i < count; i++) {
                const item: any = await publicClient.readContract({
                    address: NFT_MARKET_ADDRESS as `0x${string}`,
                    abi: [ { "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "name": "listings", "outputs": [{ "internalType": "address", "name": "seller", "type": "address" }, { "internalType": "address", "name": "nftContract", "type": "address" }, { "internalType": "uint256", "name": "tokenId", "type": "uint256" }, { "internalType": "address", "name": "paymentToken", "type": "address" }, { "internalType": "uint256", "name": "price", "type": "uint256" }, { "internalType": "bool", "name": "active", "type": "bool" }], "stateMutability": "view", "type": "function" } ],
                    functionName: 'listings',
                    args: [BigInt(i)]
                });

                if (item && item[5] === true) {
                    let currencyName = "BNB";
                    const paymentTokenAddr = item[3].toLowerCase();
                    if (paymentTokenAddr !== "0x0000000000000000000000000000000000000000") {
                        const foundToken = Object.keys(TOKENS).find(k => TOKENS[k].address.toLowerCase() === paymentTokenAddr);
                        if (foundToken) currencyName = foundToken;
                    }
                    const decimals = TOKENS[currencyName]?.decimals || 18;
                    const displayPrice = formatUnits(item[4], decimals);
                    
                    let metaName = `Item #${item[2]}`;
                    let metaImage = null;
                    try {
                        const tokenURI = await publicClient.readContract({
                            address: item[1], abi: parseAbi(MINTABLE_NFT_ABI), functionName: 'tokenURI', args: [item[2]]
                        }) as string;
                        if (tokenURI) {
                            const metaRes = await axios.get(convertIpfsToHttp(tokenURI));
                            metaName = metaRes.data.name || metaName;
                            metaImage = metaRes.data.image || null;
                        }
                    } catch (e) {}

                    loadedItems.push({ id: i, seller: item[0], nftContract: item[1], tokenId: item[2].toString(), currency: currencyName, price: displayPrice, rawPrice: item[4], name: metaName, image: metaImage });
                }
            }
            setListings(loadedItems);
        } catch (err) {}
    };

    const handleBuy = async (item: any) => {
        if (!publicClient) return;
        if (!isConnected) { alert("Connect Wallet!"); return; }
        if (chainId !== TARGET_CHAIN_ID) { switchChain({ chainId: TARGET_CHAIN_ID }); return; }

        try {
            const tokenConfig = TOKENS[item.currency];
            if (item.currency === "BNB") {
                const txHash = await writeContractAsync({
                    address: NFT_MARKET_ADDRESS as `0x${string}`,
                    abi: [{ "inputs": [{ "internalType": "uint256", "name": "_listingId", "type": "uint256" }], "name": "buyNFT", "outputs": [], "stateMutability": "payable", "type": "function" }],
                    functionName: 'buyNFT',
                    args: [BigInt(item.id)],
                    value: BigInt(item.rawPrice)
                });
                alert("Processing BNB Buy...");
                await publicClient.waitForTransactionReceipt({ hash: txHash });
            } else {
                alert(`Approve ${item.currency}...`);
                const approveTxHash = await writeContractAsync({
                    address: tokenConfig.address as `0x${string}`, abi: ERC20_ABI, functionName: 'approve', args: [NFT_MARKET_ADDRESS as `0x${string}`, BigInt(item.rawPrice)]
                });
                await publicClient.waitForTransactionReceipt({ hash: approveTxHash });

                alert("Confirm Buy...");
                const buyTxHash = await writeContractAsync({
                    address: NFT_MARKET_ADDRESS as `0x${string}`,
                    abi: [{ "inputs": [{ "internalType": "uint256", "name": "_listingId", "type": "uint256" }], "name": "buyNFT", "outputs": [], "stateMutability": "payable", "type": "function" }],
                    functionName: 'buyNFT',
                    args: [BigInt(item.id)]
                });
                await publicClient.waitForTransactionReceipt({ hash: buyTxHash });
            }
            alert("✅ Purchase Successful!");
            fetchListings();
        } catch (error: any) { alert("❌ Purchase Failed: " + (error.message)); }
    };

    useEffect(() => { fetchListings(); }, []);
    
    return (
        <div className="max-w-6xl mx-auto animate-in fade-in pb-20">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-bold text-[#0f172a]">Marketplace</h2>
                <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
                    <button onClick={()=>setViewMode('BROWSE')} className={`px-6 py-2 rounded-lg font-bold text-sm ${viewMode==='BROWSE' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>Browse</button>
                    <button onClick={()=>setViewMode('SELL')} className={`px-6 py-2 rounded-lg font-bold text-sm ${viewMode==='SELL' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500'}`}>+ Sell</button>
                </div>
            </div>
            {/* ... (UI ส่วนแสดงผลคงเดิม) ... */}
            {viewMode === 'SELL' ? (
                <div className="max-w-2xl mx-auto bg-white p-8 rounded-3xl shadow-xl border border-slate-100 relative overflow-hidden">
                    {isLoading && <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-20 flex flex-col items-center justify-center text-orange-600 font-bold px-4 text-center"><Loader2 size={48} className="animate-spin mb-4"/><div className="text-xl mb-2">{status}</div></div>}
                    <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">🛠️ Create New Item</h3>
                    <div className="space-y-5">
                        <div><label className="text-sm font-bold text-slate-500 mb-2 block flex items-center gap-1"><ImageIcon size={16}/> Item Image</label><label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-300 rounded-2xl cursor-pointer hover:border-orange-500 hover:bg-orange-50 transition-all overflow-hidden relative">{imagePreview ? <img src={imagePreview} className="w-full h-full object-cover" /> : <div className="flex flex-col items-center justify-center pt-5 pb-6"><UploadCloud className="w-10 h-10 mb-3 text-slate-400" /><p className="text-sm text-slate-500">Click to upload</p></div>}<input type="file" accept="image/*" className="hidden" onChange={handleImageChange} /></label></div>
                        <input type="text" value={itemName} onChange={e=>setItemName(e.target.value)} className="w-full bg-slate-50 p-3 rounded-xl border font-bold" placeholder="Item Name" />
                        <textarea value={itemDescription} onChange={e=>setItemDescription(e.target.value)} className="w-full bg-slate-50 p-3 rounded-xl border" rows={3} placeholder="Description"></textarea>
                        <div className="grid grid-cols-2 gap-4">
                            <input type="number" value={sellPrice} onChange={e=>setSellPrice(e.target.value)} className="w-full bg-slate-50 p-3 rounded-xl border font-bold text-xl" placeholder="Price" />
                            <select value={sellCurrency} onChange={e=>setSellCurrency(e.target.value)} className="w-full bg-slate-50 p-3 rounded-xl border font-bold">{Object.keys(TOKENS).filter(t=>t!=='ABronze').map(t => <option key={t} value={t}>{t}</option>)}</select>
                        </div>
                        <button onClick={handleMintAndList} disabled={isLoading || !itemName || !sellPrice} className="w-full bg-orange-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-orange-700">Mint & List Item</button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {listings.map((item) => (
                        <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-xl transition-all">
                            <div className="h-48 bg-slate-50 rounded-xl mb-4 overflow-hidden relative flex items-center justify-center">
                                {item.image ? <img src={convertIpfsToHttp(item.image)} className="w-full h-full object-cover" /> : <div className="text-4xl">📦</div>}
                                <div className="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded-lg text-xs font-bold shadow-sm">ID #{item.tokenId}</div>
                            </div>
                            <h3 className="font-bold text-lg text-slate-800">{item.name}</h3>
                            <div className="flex justify-between items-center mt-4">
                                <div className="font-extrabold text-xl flex items-center gap-1">{TOKENS[item.currency]?.icon} {item.price}</div>
                                {address !== item.seller && <button onClick={() => handleBuy(item)} className="bg-[#0f172a] text-white font-bold px-5 py-2.5 rounded-xl shadow-lg hover:bg-[#1e293b]">Buy</button>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- STAKING SECTION ---
const TokenOptionCard = ({ tokenKey, isSelected, onClick, userAddress, STAKING_ADDRESS, STAKING_READ_ABI }: any) => {
    const token = TOKENS[tokenKey];
    if (!token) return null;
    const { writeContractAsync } = useWriteContract();
    
    // ... (Logic Staking Card คงเดิม)
    return (
        <div onClick={() => onClick(tokenKey)} className={`relative flex flex-col gap-3 p-5 rounded-3xl border-2 cursor-pointer ${isSelected ? 'bg-yellow-50 border-yellow-500' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center gap-3"><span className="text-3xl">{token.icon}</span><span className="font-bold text-lg">{tokenKey}</span></div>
        </div>
    );
};

const StakingSection = () => {
    const { address, isConnected } = useAccount();
    const [stakeToken, setStakeToken] = useState("USDT");
    const [amount, setAmount] = useState("");
    const { writeContractAsync } = useWriteContract();
    const chainId = useChainId();
    const { switchChain } = useSwitchChain();

    // ... (Staking logic คงเดิม แต่เพิ่มการเช็ค Network)
    const handleAction = async () => {
        if (!isConnected || !amount) return;
        if (chainId !== TARGET_CHAIN_ID) { switchChain({ chainId: TARGET_CHAIN_ID }); return; }
        // ... (Logic Stake/Withdraw)
        alert("Action triggered (Please implement contract logic)");
    };

    return (
        <div className="max-w-6xl mx-auto animate-in fade-in pb-20">
            <div className="bg-gradient-to-r from-[#78350f] to-[#b45309] rounded-3xl p-8 text-white mb-10 shadow-2xl relative overflow-hidden">
                <div className="flex items-center gap-6 relative z-10">
                    <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/20"><div className="text-6xl">🥉</div></div>
                    <div><div className="text-orange-200 font-bold mb-1">Your Rewards</div><div className="text-5xl font-extrabold mb-2 text-yellow-300">0.00 <span className="text-2xl font-normal text-white ml-2">ABronze</span></div></div>
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-7 bg-white rounded-3xl p-6 shadow-xl border border-slate-100">
                    <h3 className="text-xl font-bold mb-6 text-[#0f172a] flex items-center gap-2"><LayoutGrid size={20} className="text-blue-600"/> BNB Staking Pools</h3>
                    <div className="grid grid-cols-1 gap-4">
                        {Object.keys(TOKENS).filter(t => !["ABronze", "1narai"].includes(t)).map(t => (
                            <TokenOptionCard key={t} tokenKey={t} isSelected={stakeToken === t} onClick={setStakeToken} userAddress={address} STAKING_ADDRESS={STAKING_ADDRESS} STAKING_READ_ABI={[]} />
                        ))}
                    </div>
                </div>
                {/* ... (Staking Panel) */}
            </div>
        </div>
    );
};

// --- POOLS SECTION ---
const PoolsSection = () => {
    return (
        <div className="max-w-6xl mx-auto pb-20">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">BNB Pools <span className="text-sm bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">BSC</span></h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                    { pair: "ADS - USDT", reward: "ABronze", apr: "320%" },
                    { pair: "BNB - USDT", reward: "ABronze", apr: "15%" },
                    { pair: "BTCB - BNB", reward: "ABronze", apr: "12%" }
                ].map((pool, idx) => (
                    <div key={idx} className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all">
                        <h3 className="font-bold text-lg mb-2">{pool.pair}</h3>
                        <div className="text-sm text-slate-600">APR: {pool.apr}</div>
                        <button className="w-full mt-4 border border-blue-600 text-blue-600 font-bold py-2 rounded-lg hover:bg-blue-50">Add Liquidity</button>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- MAIN APP ---
export default function CryptoExchange() {
  const [activeMenu, setActiveMenu] = useState('Swap');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // ✅ 3. Enforce Network Globally
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { isConnected } = useAccount();

  useEffect(() => {
    if (isConnected && chainId !== TARGET_CHAIN_ID) {
      console.log(`Wrong Network (${chainId}). Switching to ${TARGET_CHAIN_ID}...`);
      switchChain({ chainId: TARGET_CHAIN_ID });
    }
  }, [chainId, isConnected, switchChain]);

  const navItems = [
    { name: 'Swap', type: 'button' },
    { name: 'Marketplace', type: 'button' },
    { name: 'Staking', type: 'button' },
    { name: 'Pools Liquidity', type: 'button' },
     { name: 'Shopping Mall', type: 'link', href: '/mall' }, 
  ];

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
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-900">
      <header className="bg-[#0f172a] text-white border-b border-slate-800 sticky top-0 z-50 shadow-md">
        <div className="container mx-auto px-4 h-16 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveMenu('Swap')}>
            <img src="img/logo200.png" alt="Logo" className="w-10 h-10 object-contain" />
            <span className="text-xl font-bold tracking-tight">Onenarai <span className="text-yellow-400">BSC</span></span>
          </div>
          <nav className="hidden md:flex gap-1 text-sm font-medium text-slate-400">
            {navItems.map((item) => (
              item.type === 'link' ? 
                <Link key={item.name} href={item.href || '#'} className="px-4 py-2 rounded-lg hover:text-white transition-all flex items-center">{item.name}</Link> : 
                <button key={item.name} onClick={() => setActiveMenu(item.name)} className={`px-4 py-2 rounded-lg transition-all ${activeMenu === item.name ? 'bg-slate-800 text-white' : 'hover:text-white'}`}>{item.name}</button>
            ))}
          </nav>
          <div className="flex items-center gap-4">
              <ConnectButton showBalance={false} chainStatus="icon" accountStatus="avatar" />
              <button className="md:hidden p-2" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>{isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}</button>
          </div>
        </div>
        {isMobileMenuOpen && (
            <div className="md:hidden bg-[#0f172a] border-b border-slate-800 p-4 absolute w-full z-50 shadow-xl">
                {navItems.map((item) => (
                    item.type === 'link' ? 
                    <Link key={item.name} href={item.href || '#'} className="block w-full text-left p-3 text-slate-300 hover:text-white font-bold hover:bg-slate-800 rounded-lg transition-colors">{item.name}</Link> : 
                    <button key={item.name} onClick={() => { setActiveMenu(item.name); setIsMobileMenuOpen(false); }} className={`block w-full text-left p-3 font-bold rounded-lg transition-colors ${activeMenu === item.name ? 'text-white bg-slate-800' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}>{item.name}</button>
                ))}
            </div>
        )}
      </header>
      <main className="container mx-auto px-4 py-8">{renderContent()}</main>
    </div>
  );
}