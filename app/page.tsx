'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { parseEther, formatEther, parseUnits, formatUnits, parseAbi } from 'viem';
import { 
  ChevronDown, Activity, ShieldCheck, 
  ArrowRightLeft, X, Loader2, Wallet ,
  Heart, Search, Filter, Zap, LayoutGrid ,Menu,
  Droplets, TrendingUp, Plus, Coins,
  Scale, Info, Image as ImageIcon, UploadCloud // ✅ เพิ่มไอคอนสำหรับอัปโหลดรูป
} from 'lucide-react';
import axios from 'axios';

// ==========================================
// 1. CONFIGURATION & ADDRESSES
// ==========================================

const TOKENS: Record<string, { address: string; decimals: number; icon: string }> = {
    "ETH":      { address: "NATIVE", decimals: 18, icon: "🔷" },
    "USDT":     { address: "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0", decimals: 6, icon: "💵" },
    "DAI":      { address: "0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357", decimals: 18, icon: "🔸" },
    "USDC":     { address: "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8", decimals: 6, icon: "💲" },
    "EURS":     { address: "0x6d906e526a4e2Ca02097BA9d0caA3c382F52278E", decimals: 18, icon: "💶" },
    "AAVE":     { address: "0x88541670E55cC00bEEFD87eB59EDd1b7C511AC9a", decimals: 18, icon: "👻" },
    "LINK":     { address: "0xf8Fb3713D459D7C1018BD0A49D19b4C44290EBE5", decimals: 18, icon: "🔗" },
    "WBTC":     { address: "0x29f2D40B0605204364af54EC677bD022dA425d03", decimals: 8, icon: "₿" },
    "ADS":      { address: "0xA3b1173bcba20Cf8E6200fDd4ba673DE9efE588C", decimals: 18, icon: "🅰️" },
    "1narai":   { address: "0x60aDb883e0966082c368c65Fa87302B0c0AE5230", decimals: 18, icon: "1️⃣" },
    "ABronze":  { address: "0x08211a3e28471c1D766976E346afe3E9CC3a81a5", decimals: 18, icon: "🥉" },
    "ASilver":  { address: "0xd074950365e8884cB6733A1394382590b68C56b0", decimals: 18, icon: "🥈" },
    "AGold":    { address: "0x9789562A25c75e55ad4ef9Bdc7B5dDf7b3957947", decimals: 18, icon: "🥇" },
};

const ROUTER_ADDRESS = "0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008"; 
const STAKING_ADDRESS = "0x56276C587EF4B3F389FFFfcB2419e0d4d2832Ed7"; 
const NFT_MARKET_ADDRESS = "0xcc51dA9b9D5c1e27D7EF93FCAa00312f5fCDC5Bb"; 

const PINATA_API_KEY = "cc4ebea4b0daa46075e0";
const PINATA_API_SECRET = "30db676b0f0973eb1ebc359e9ab5c7ea64228cde683046415d4bd5937fb019cc";
const MINTABLE_NFT_ADDRESS = "0x9E3A405377E56b463b76338631EEC105c97a9B6e"; 

// ✅ ใช้ parseAbi เพื่อความชัวร์ (อย่าลืม import parseAbi จาก 'viem')
const ERC20_ABI = parseAbi([
    "function balanceOf(address owner) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)"
]);

const ROUTER_ABI = [
    { "inputs": [{ "internalType": "uint256", "name": "amountOutMin", "type": "uint256" }, { "internalType": "address[]", "name": "path", "type": "address[]" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }], "name": "swapExactETHForTokens", "outputs": [], "stateMutability": "payable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "amountIn", "type": "uint256" }, { "internalType": "uint256", "name": "amountOutMin", "type": "uint256" }, { "internalType": "address[]", "name": "path", "type": "address[]" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }], "name": "swapExactTokensForTokens", "outputs": [], "stateMutability": "nonpayable", "type": "function" }
];

// ✅ เพิ่ม tokenURI ใน ABI เพื่อให้อ่าน Metadata ได้
const MINTABLE_NFT_ABI = [
    "function mintItem(address recipient, string memory tokenURI) public returns (uint256)",
    "function approve(address to, uint256 tokenId) public",
    "function tokenURI(uint256 tokenId) public view returns (string memory)", 
    "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
];

// Helper: แปลง IPFS Link เป็น HTTP Link
const convertIpfsToHttp = (uri: string) => {
    if (!uri) return "";
    if (uri.startsWith('ipfs://')) {
        return uri.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
    }
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
      script.innerHTML = `{"autosize": true,"symbol": "BINANCE:BTCUSDT","interval": "D","timezone": "Etc/UTC","theme": "light","style": "1","locale": "en","enable_publishing": false,"hide_top_toolbar": false,"hide_legend": false,"save_image": false,"calendar": false,"hide_volume": true,"support_host": "https://www.tradingview.com"}`;
      container.current.appendChild(script);
    }
  }, []);
  return <div className="h-full w-full" ref={container} />;
};

// --- SWAP SECTION ---
const SwapSection = () => {
    const { address, isConnected } = useAccount();
    const [payToken, setPayToken] = useState("USDT");
    const [receiveToken, setReceiveToken] = useState("ADS");
    const [amountIn, setAmountIn] = useState("");
    const [amountOut, setAmountOut] = useState("");
    const { writeContract, isPending } = useWriteContract();

    useEffect(() => {
        if (!amountIn) { setAmountOut(""); return; }
        const val = parseFloat(amountIn);
        if ((payToken === 'USDT' || payToken === 'ADS' || payToken === '1narai') && 
            (receiveToken === 'USDT' || receiveToken === 'ADS' || receiveToken === '1narai')) {
            setAmountOut(val.toString());
        } else if (payToken === 'ETH') {
            setAmountOut((val * 2500).toString());
        } else {
            setAmountOut((val * 0.98).toString());
        }
    }, [amountIn, payToken, receiveToken]);

    const handleSwap = () => {
        if (!isConnected || !amountIn) return;
        if (TOKENS[payToken].address === "NATIVE") {
             writeContract({
                address: ROUTER_ADDRESS as `0x${string}`,
                abi: ROUTER_ABI,
                functionName: 'swapExactETHForTokens',
                args: [ 0, [TOKENS['USDT'].address, TOKENS[receiveToken].address], address, Math.floor(Date.now() / 1000) + 60 * 20 ],
                value: parseEther(amountIn)
            });
        } else {
             alert(`Swap ${payToken} to ${receiveToken} Initiated! (Requires Approve first)`);
        }
    };

    const TokenSelect = ({ value, onChange, label }: any) => (
        <div className="relative group">
            <label className="text-xs text-slate-500 mb-1 block">{label}</label>
            <button className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-sm text-sm font-bold text-[#0f172a] w-full justify-between hover:bg-slate-50">
                <span className="flex items-center gap-2">{TOKENS[value].icon} {value}</span>
                <ChevronDown size={16} />
            </button>
            <div className="absolute top-full left-0 w-full bg-white rounded-xl shadow-xl border border-slate-100 hidden group-hover:block z-50 max-h-60 overflow-y-auto">
                {Object.keys(TOKENS).map((t) => (
                    <button key={t} onClick={() => onChange(t)} className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm font-bold text-slate-700 flex items-center gap-2">
                        {TOKENS[t].icon} {t}
                    </button>
                ))}
            </div>
        </div>
    );

    return (
        <div className="grid grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="col-span-12 lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 p-1 min-h-[500px]">
                <TradingViewWidget />
            </div>
            <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-xl border border-blue-100 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-600"></div>
                    <h2 className="font-bold text-lg text-[#0f172a] mb-6">Swap Interface</h2>
                    <div className="space-y-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <div className="flex gap-4">
                                <div className="flex-1"><input type="number" value={amountIn} onChange={(e)=>setAmountIn(e.target.value)} placeholder="0.0" className="bg-transparent text-2xl font-bold w-full outline-none" /></div>
                                <div className="w-32"><TokenSelect value={payToken} onChange={setPayToken} label="You Pay" /></div>
                            </div>
                        </div>
                        <div className="flex justify-center -my-4 relative z-10">
                            <button className="bg-white border p-2 rounded-lg shadow-sm text-blue-600"><ArrowRightLeft size={18} /></button>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <div className="flex gap-4">
                                <div className="flex-1"><input type="number" readOnly value={amountOut} placeholder="0.0" className="bg-transparent text-2xl font-bold w-full outline-none text-slate-700" /></div>
                                <div className="w-32"><TokenSelect value={receiveToken} onChange={setReceiveToken} label="Receive" /></div>
                            </div>
                        </div>
                    </div>
                    <div className="mt-6">
                        {!isConnected ? <ConnectButton /> : (
                            <button onClick={handleSwap} disabled={isPending || !amountIn} className="w-full bg-[#0f172a] hover:bg-[#1e293b] text-white font-bold py-4 rounded-xl shadow-lg transition-all">
                                {isPending ? "Swapping..." : `Swap ${payToken} to ${receiveToken}`}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- MARKETPLACE SECTION (Updated: Image Upload) ---
const MarketplaceSection = () => {
    const { address, isConnected } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient(); 
    const [viewMode, setViewMode] = useState<'BROWSE' | 'SELL'>('BROWSE');

    // State สำหรับฟอร์ม Mint & Sell
    const [itemName, setItemName] = useState("");
    const [itemDescription, setItemDescription] = useState("");
    const [itemWeight, setItemWeight] = useState(""); 
    const [sellPrice, setSellPrice] = useState("");
    const [sellCurrency, setSellCurrency] = useState("ADS");
    
    // ✅ State สำหรับรูปภาพ
    const [itemImageFile, setItemImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    
    const [status, setStatus] = useState(""); 
    const [isLoading, setIsLoading] = useState(false);
    const [listings, setListings] = useState<any[]>([]);

    // ✅ Handle เลือกไฟล์รูปภาพ
    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setItemImageFile(file);
            const previewUrl = URL.createObjectURL(file);
            setImagePreview(previewUrl);
        }
    };

    // ✅ ฟังก์ชันอัปโหลดรูปภาพไป Pinata
    const uploadImageToIPFS = async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;
        const response = await axios.post(url, formData, {
            headers: {
                'pinata_api_key': PINATA_API_KEY,
                'pinata_secret_api_key': PINATA_API_SECRET,
                'Content-Type': 'multipart/form-data'
            }
        });
        return `ipfs://${response.data.IpfsHash}`;
    };

    // ✅ ฟังก์ชันอัปโหลด Metadata (รับ Link รูปมาใส่)
    const uploadMetadataToIPFS = async (imageUrl: string) => {
        const metadata = {
            name: itemName,
            description: itemDescription,
            image: imageUrl, // ใส่ลิงก์รูปภาพ
            attributes: [
                { trait_type: "Weight", value: itemWeight },
                { trait_type: "Created By", value: address }
            ]
        };
        const url = `https://api.pinata.cloud/pinning/pinJSONToIPFS`;
        const response = await axios.post(url, metadata, {
            headers: {
                'pinata_api_key': PINATA_API_KEY,
                'pinata_secret_api_key': PINATA_API_SECRET
            }
        });
        return `ipfs://${response.data.IpfsHash}`;
    };

    // --- ฟังก์ชันหลัก: Mint & List (Step 1-4) ---
    const handleMintAndList = async () => {
        if (!publicClient) return;
        if (!isConnected || !itemName || !sellPrice || !itemImageFile) { 
            alert("Please connect wallet, upload an image, and fill details."); return; 
        }
        setIsLoading(true);

        try {
            // STEP 1: อัปโหลดรูปภาพ
            setStatus("1/4 Uploading Image to IPFS...");
            const imageURI = await uploadImageToIPFS(itemImageFile);
            console.log("Image uploaded:", imageURI);

            // STEP 2: อัปโหลด Metadata
            setStatus("2/4 Uploading Metadata to IPFS...");
            const tokenURI = await uploadMetadataToIPFS(imageURI);
            console.log("Metadata uploaded:", tokenURI);

            // STEP 3: Mint NFT
            setStatus("3/4 Minting NFT on Blockchain...");
            const mintTxHash = await writeContractAsync({
                address: MINTABLE_NFT_ADDRESS as `0x${string}`,
                abi: parseAbi(MINTABLE_NFT_ABI),
                functionName: 'mintItem',
                args: [address as `0x${string}`, tokenURI]
            });
            
            setStatus("Waiting for Mint confirmation...");
            const receipt = await publicClient.waitForTransactionReceipt({ hash: mintTxHash });
            const transferLog = receipt.logs.find(log => log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef');
            if (!transferLog || !transferLog.topics[3]) throw new Error("Failed to retrieve Token ID");
            const newTokenId = parseInt(transferLog.topics[3], 16);
            console.log("Minted Token ID:", newTokenId);

            // STEP 4: Approve & List
            setStatus("4/4 Approving Marketplace...");
            const approveTxHash = await writeContractAsync({
                address: MINTABLE_NFT_ADDRESS as `0x${string}`,
                abi: parseAbi(MINTABLE_NFT_ABI),
                functionName: 'approve',
                args: [NFT_MARKET_ADDRESS as `0x${string}`, BigInt(newTokenId)]
            });
            setStatus("Waiting for Approval confirmation...");
            await publicClient.waitForTransactionReceipt({ hash: approveTxHash });

            setStatus("Listing Item...");
            const tokenConfig = TOKENS[sellCurrency];
            const priceWei = parseUnits(sellPrice, tokenConfig.decimals);
            const paymentTokenAddr = tokenConfig.address === "NATIVE" ? "0x0000000000000000000000000000000000000000" : tokenConfig.address;

            await writeContractAsync({
                address: NFT_MARKET_ADDRESS as `0x${string}`,
                abi: [
                    { "inputs": [{ "internalType": "address", "name": "_nftContract", "type": "address" }, { "internalType": "uint256", "name": "_tokenId", "type": "uint256" }, { "internalType": "address", "name": "_paymentToken", "type": "address" }, { "internalType": "uint256", "name": "_price", "type": "uint256" }], "name": "listNFT", "outputs": [], "stateMutability": "nonpayable", "type": "function" }
                ],
                functionName: 'listNFT',
                args: [MINTABLE_NFT_ADDRESS as `0x${string}`, BigInt(newTokenId), paymentTokenAddr as `0x${string}`, priceWei]
            });

            alert(`✅ Successfully Created & Listed "${itemName}"!`);
            // Reset form
            setItemName(""); setItemDescription(""); setItemWeight(""); setSellPrice(""); 
            setItemImageFile(null); setImagePreview(null); setStatus("");
            fetchListings();

        } catch (error) {
            console.error(error);
            setStatus("Failed! See console.");
            alert("❌ Error during process.");
        } finally {
            setIsLoading(false);
        }
    };
    
    // ✅ ฟังก์ชันอ่านข้อมูลสินค้าและ Metadata (รูปภาพ)
    const fetchListings = async () => {
        if (!publicClient) return;
        try {
            const countResult = await publicClient.readContract({
                address: NFT_MARKET_ADDRESS as `0x${string}`,
                abi: [
                    { "inputs": [], "name": "getListingsCount", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
                    { "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "name": "listings", "outputs": [{ "internalType": "address", "name": "seller", "type": "address" }, { "internalType": "address", "name": "nftContract", "type": "address" }, { "internalType": "uint256", "name": "tokenId", "type": "uint256" }, { "internalType": "address", "name": "paymentToken", "type": "address" }, { "internalType": "uint256", "name": "price", "type": "uint256" }, { "internalType": "bool", "name": "active", "type": "bool" }], "stateMutability": "view", "type": "function" }
                ],
                functionName: 'getListingsCount',
            });
            
            const count = Number(countResult);
            const loadedItems = [];

            for (let i = 0; i < count; i++) {
                const item: any = await publicClient.readContract({
                    address: NFT_MARKET_ADDRESS as `0x${string}`,
                    abi: [
                        { "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "name": "listings", "outputs": [{ "internalType": "address", "name": "seller", "type": "address" }, { "internalType": "address", "name": "nftContract", "type": "address" }, { "internalType": "uint256", "name": "tokenId", "type": "uint256" }, { "internalType": "address", "name": "paymentToken", "type": "address" }, { "internalType": "uint256", "name": "price", "type": "uint256" }, { "internalType": "bool", "name": "active", "type": "bool" }], "stateMutability": "view", "type": "function" }
                    ],
                    functionName: 'listings',
                    args: [BigInt(i)]
                });

                if (item && item[5] === true) {
                    let currencyName = "ETH";
                    const paymentTokenAddr = item[3].toLowerCase();
                    if (paymentTokenAddr !== "0x0000000000000000000000000000000000000000") {
                        const foundToken = Object.keys(TOKENS).find(k => TOKENS[k].address.toLowerCase() === paymentTokenAddr);
                        if (foundToken) currencyName = foundToken;
                    }
                    const decimals = TOKENS[currencyName].decimals;
                    const displayPrice = formatUnits(item[4], decimals);
                    const tokenId = item[2].toString();

                    // ✅ ดึง Metadata จริง
                    let metaName = `Item #${tokenId}`;
                    let metaImage = null;
                    try {
                        // อ่าน TokenURI จาก Contract
                        const tokenURI = await publicClient.readContract({
                            address: item[1], // Contract Address ของ NFT
                            abi: parseAbi(MINTABLE_NFT_ABI),
                            functionName: 'tokenURI',
                            args: [item[2]]
                        }) as string;

                        if (tokenURI) {
                            const httpUri = convertIpfsToHttp(tokenURI);
                            const metaRes = await axios.get(httpUri);
                            metaName = metaRes.data.name || metaName;
                            metaImage = metaRes.data.image || null;
                        }
                    } catch (e) {
                        console.warn("Error fetching metadata", e);
                    }

                    loadedItems.push({
                        id: i,
                        seller: item[0],
                        nftContract: item[1],
                        tokenId: tokenId,
                        currency: currencyName,
                        price: displayPrice,
                        rawPrice: item[4],
                        name: metaName,
                        image: metaImage 
                    });
                }
            }
            setListings(loadedItems);
        } catch (err) {
            console.error("Error fetching listings:", err);
        }
    };

   // 5. ฟังก์ชันซื้อ (Buy) - ฉบับแก้ไข Approve
    const handleBuy = async (item: any) => {
        if (!publicClient) return;
        if (!isConnected) { alert("Please connect wallet first!"); return; }
        
        try {
            // เช็คข้อมูลก่อนเริ่ม
            if (!item.rawPrice) { alert("Error: Item price is missing"); return; }
            if (!NFT_MARKET_ADDRESS) { alert("Error: Market address is missing"); return; }

            const tokenConfig = TOKENS[item.currency];
            
            // Log ดูค่าที่จะส่งไป (กด F12 ดู Console ถ้ายังไม่ได้)
            console.log("Buying Item:", item);
            console.log("Token Address:", tokenConfig?.address);
            console.log("Spender (Market):", NFT_MARKET_ADDRESS);
            console.log("Amount:", item.rawPrice.toString());

            if (item.currency === "ETH") {
                // --- จ่ายด้วย ETH ---
                const txHash = await writeContractAsync({
                    address: NFT_MARKET_ADDRESS as `0x${string}`,
                    abi: [{ "inputs": [{ "internalType": "uint256", "name": "_listingId", "type": "uint256" }], "name": "buyNFT", "outputs": [], "stateMutability": "payable", "type": "function" }],
                    functionName: 'buyNFT',
                    args: [BigInt(item.id)],
                    value: BigInt(item.rawPrice)
                });
                alert("Processing ETH Buy...");
                await publicClient.waitForTransactionReceipt({ hash: txHash });

            } else {
                // --- จ่ายด้วย Token (ADS/USDT) ---
                if (!tokenConfig || !tokenConfig.address) { alert("Invalid Token Config"); return; }

                alert(`Buying with ${item.currency}... Step 1: Approve`);
                
                // 1. Approve Token
                // ใช้ ABI แบบ parseAbi ที่แก้ใหม่ด้านบน
                const approveTxHash = await writeContractAsync({
                    address: tokenConfig.address as `0x${string}`,
                    abi: ERC20_ABI, 
                    functionName: 'approve',
                    args: [NFT_MARKET_ADDRESS as `0x${string}`, BigInt(item.rawPrice)]
                });

                alert("Waiting for Approval confirmation... (Please wait)");
                await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
                console.log("Approved! Now Buying...");

                // 2. Buy NFT
                alert("Step 2: Confirm Buy");
                const buyTxHash = await writeContractAsync({
                    address: NFT_MARKET_ADDRESS as `0x${string}`,
                    abi: [{ "inputs": [{ "internalType": "uint256", "name": "_listingId", "type": "uint256" }], "name": "buyNFT", "outputs": [], "stateMutability": "payable", "type": "function" }],
                    functionName: 'buyNFT',
                    args: [BigInt(item.id)]
                });
                
                await publicClient.waitForTransactionReceipt({ hash: buyTxHash });
            }
            
            alert("✅ Purchase Successful!");
            fetchListings(); // โหลดรายการใหม่

        } catch (error: any) {
            console.error("Buy Error:", error);
            if (error.message.includes("User denied")) {
                alert("❌ You rejected the transaction.");
            } else {
                // แสดง Error จริงที่เกิดขึ้น
                alert("❌ Purchase Failed: " + (error.shortMessage || error.message));
            }
        }
    };

    useEffect(() => {
        fetchListings();
    }, []);
    
    return (
        <div className="max-w-6xl mx-auto animate-in fade-in pb-20">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-bold text-[#0f172a]">Marketplace</h2>
                <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
                    <button onClick={()=>setViewMode('BROWSE')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${viewMode==='BROWSE' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Browse</button>
                    <button onClick={()=>setViewMode('SELL')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${viewMode==='SELL' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}>+ Create & Sell</button>
                </div>
            </div>

            {viewMode === 'SELL' ? (
                // --- CREATE & SELL FORM ---
                <div className="max-w-2xl mx-auto bg-white p-8 rounded-3xl shadow-xl border border-slate-100 relative overflow-hidden">
                    {isLoading && (
                        <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-20 flex flex-col items-center justify-center text-orange-600 font-bold px-4 text-center">
                            <Loader2 size={48} className="animate-spin mb-4"/>
                            <div className="text-xl mb-2">{status}</div>
                            <div className="text-sm text-slate-500 font-normal">Please confirm transactions in your wallet.</div>
                        </div>
                    )}

                    <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">🛠️ Create New Item</h3>
                    
                    <div className="space-y-5">
                        {/* ✅ ช่องอัปโหลดรูปภาพ */}
                        <div>
                            <label className="text-sm font-bold text-slate-500 mb-2 block flex items-center gap-1"><ImageIcon size={16}/> Item Image *</label>
                            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-300 rounded-2xl cursor-pointer hover:border-orange-500 hover:bg-orange-50 transition-all overflow-hidden relative">
                                {imagePreview ? (
                                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <UploadCloud className="w-10 h-10 mb-3 text-slate-400" />
                                        <p className="mb-2 text-sm text-slate-500"><span className="font-semibold">Click to upload</span></p>
                                        <p className="text-xs text-slate-500">PNG, JPG or GIF</p>
                                    </div>
                                )}
                                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                            </label>
                        </div>

                        <div>
                            <label className="text-sm font-bold text-slate-500 mb-1 block">Item Name *</label>
                            <input type="text" value={itemName} onChange={e=>setItemName(e.target.value)} className="w-full bg-slate-50 p-3 rounded-xl border font-bold" placeholder="e.g. Legendary Sword" />
                        </div>
                        <div>
                            <label className="text-sm font-bold text-slate-500 mb-1 block">Description</label>
                            <textarea value={itemDescription} onChange={e=>setItemDescription(e.target.value)} className="w-full bg-slate-50 p-3 rounded-xl border" rows={3} placeholder="Describe your item..."></textarea>
                        </div>
                        <div>
                             <label className="text-sm font-bold text-slate-500 mb-1 block flex items-center gap-1"><Scale size={16}/> Weight / Specs (Optional)</label>
                            <input type="text" value={itemWeight} onChange={e=>setItemWeight(e.target.value)} className="w-full bg-slate-50 p-3 rounded-xl border" placeholder="e.g. 2.5 kg, Size L" />
                        </div>

                        <hr className="border-slate-100 my-4"/>

                        <h4 className="font-bold text-lg">💰 Set Price</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-bold text-slate-500 mb-1 block">Price *</label>
                                <input type="number" value={sellPrice} onChange={e=>setSellPrice(e.target.value)} className="w-full bg-slate-50 p-3 rounded-xl border font-bold text-xl" placeholder="0.00" />
                            </div>
                            <div>
                                <label className="text-sm font-bold text-slate-500 mb-1 block">Receive In</label>
                                <div className="relative">
                                    <select value={sellCurrency} onChange={e=>setSellCurrency(e.target.value)} className="w-full bg-slate-50 p-3 rounded-xl border font-bold appearance-none cursor-pointer pr-10">
                                        {Object.keys(TOKENS).filter(t=>t!=='ABronze').map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm">▼</div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-blue-50 text-blue-800 text-sm rounded-xl border border-blue-100 flex items-start gap-2">
                            <Info size={18} className="shrink-0 mt-0.5"/>
                            <div>This process will: 1. Upload Image & Metadata to IPFS, 2. Mint NFT, 3. Approve marketplace, 4. List it for sale.</div>
                        </div>

                        <button onClick={handleMintAndList} disabled={isLoading || !itemName || !sellPrice || !itemImageFile} className="w-full bg-orange-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-orange-700 transition-all active:scale-95 disabled:opacity-50 text-lg flex items-center justify-center gap-2">
                            {isLoading ? "Processing..." : "Mint & List Item"}
                        </button>
                    </div>
                </div>
            ) : (
                // --- BROWSE GRID (Real Data) ---
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="col-span-full flex justify-end">
                        <button onClick={fetchListings} className="text-sm text-blue-600 font-bold hover:underline flex items-center gap-1">
                            Refresh List <span className="text-xs">↻</span>
                        </button>
                    </div>

                    {listings.length === 0 ? (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400 opacity-60">
                            <div className="text-6xl mb-4">📦</div>
                            <div>No items found. Be the first to list!</div>
                        </div>
                    ) : (
                        listings.map((item) => (
                            <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                                {/* ✅ แสดงรูปภาพสินค้า */}
                                <div className="h-48 bg-slate-50 rounded-xl mb-4 overflow-hidden relative flex items-center justify-center group-hover:bg-slate-100 transition-colors">
                                    {item.image ? (
                                        <img src={convertIpfsToHttp(item.image)} alt={item.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                    ) : (
                                        <div className="text-6xl grayscale group-hover:grayscale-0 transition-all">⚔️</div>
                                    )}
                                    <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-bold text-slate-600 shadow-sm">
                                        ID #{item.tokenId}
                                    </div>
                                    <div className="absolute top-2 left-2 bg-orange-100 text-orange-700 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                                        NFT
                                    </div>
                                </div>

                                <h3 className="font-bold text-lg text-slate-800 mb-1">{item.name}</h3>
                                <div className="text-xs text-slate-400 truncate mb-4 bg-slate-50 p-2 rounded-lg flex items-center gap-1">
                                    <span>Seller:</span> 
                                    <span className="font-mono text-slate-600">{item.seller.slice(0,6)}...{item.seller.slice(-4)}</span>
                                </div>
                                
                                <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-50">
                                    <div>
                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Price</div>
                                        <div className="font-extrabold text-xl flex items-center gap-1 text-slate-900">
                                            {TOKENS[item.currency]?.icon || '💰'} {item.price} 
                                            <span className="text-sm text-slate-500 font-normal">{item.currency}</span>
                                        </div>
                                    </div>
                                    
                                    {address !== item.seller ? (
                                        <button 
                                            onClick={() => handleBuy(item)} 
                                            className="bg-[#0f172a] text-white font-bold px-5 py-2.5 rounded-xl shadow-lg hover:bg-[#1e293b] active:scale-95 transition-all flex items-center gap-2"
                                        >
                                            Buy
                                        </button>
                                    ) : (
                                        <div className="text-xs font-bold text-orange-400 bg-orange-50 px-3 py-1 rounded-lg">
                                            You Own This
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

// --- STAKING SECTION ---
const TokenOptionCard = ({ tokenKey, isSelected, onClick, userAddress, STAKING_ADDRESS, STAKING_READ_ABI }: any) => {
    const token = TOKENS[tokenKey];
    const { writeContractAsync } = useWriteContract();
    const [isClaiming, setIsClaiming] = useState(false);
    
    const { data: poolInfo } = useReadContract({
        address: STAKING_ADDRESS,
        abi: STAKING_READ_ABI,
        functionName: 'pools',
        args: [token.address as `0x${string}`],
        query: { refetchInterval: 5000 }
    });
    const totalStaked = poolInfo ? (poolInfo as any)[3] : 0n;
    const rewardPerSecond = poolInfo ? (poolInfo as any)[2] : 0n;

    const { data: userInfo } = useReadContract({
        address: STAKING_ADDRESS,
        abi: STAKING_READ_ABI,
        functionName: 'userInfo',
        args: [token.address as `0x${string}`, userAddress],
        query: { refetchInterval: 5000 }
    });
    const userStaked = userInfo ? (userInfo as any)[0] : 0n;

    const { data: pendingReward, refetch: refetchReward } = useReadContract({
        address: STAKING_ADDRESS,
        abi: STAKING_READ_ABI,
        functionName: 'calculatePendingReward',
        args: [token.address as `0x${string}`, userAddress],
        query: { refetchInterval: 5000 }
    });

    const handleCardClaim = async (e: any) => {
        e.stopPropagation();
        if (!pendingReward || (pendingReward as bigint) <= 0n) return;
        setIsClaiming(true);
        try {
            await writeContractAsync({ 
                address: STAKING_ADDRESS, 
                abi: [{ "inputs": [{ "internalType": "address", "name": "token", "type": "address" }], "name": "claimReward", "outputs": [], "stateMutability": "nonpayable", "type": "function" }], 
                functionName: 'claimReward', 
                args: [token.address as `0x${string}`] 
            });
            alert(`✅ Claimed ${tokenKey} Rewards!`);
            refetchReward();
        } catch (error) { console.error(error); } finally { setIsClaiming(false); }
    };

    const calculateDynamicAPR = () => {
        if (!totalStaked || totalStaked === 0n || !rewardPerSecond) return "0.00";
        const yearlyReward = rewardPerSecond * 31536000n;
        const apr = (Number(yearlyReward) / Number(totalStaked)) * 100;
        return isFinite(apr) ? apr.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "∞";
    };

    const dynamicAPR = calculateDynamicAPR();
    // ใช้ Ternary Operator เพื่อบังคับให้ผลลัพธ์เป็น boolean (true/false) เท่านั้น
    const hasReward = pendingReward ? (pendingReward as bigint) > BigInt(0) : false;
    
    return (
        <div 
            onClick={() => onClick(tokenKey)} 
            className={`relative flex flex-col justify-between gap-3 p-5 rounded-3xl border-2 transition-all text-left shadow-sm cursor-pointer group ${isSelected ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-200 shadow-md' : 'border-slate-100 hover:border-blue-300 hover:shadow-md bg-white hover:bg-slate-50'}`}
        >
            <div className="flex justify-between items-start w-full mb-2">
                <div className="flex items-center gap-3">
                    <span className="text-4xl drop-shadow-sm group-hover:scale-110 transition-transform">{token.icon}</span>
                    <span className="font-extrabold text-3xl text-slate-800">{tokenKey}</span>
                </div>
                <div className="text-xs font-bold text-green-700 bg-green-100/80 border border-green-200 px-2 py-1 rounded-lg backdrop-blur-sm shadow-sm">
                   ⚡ {dynamicAPR}%
                </div>
            </div>

            <div className="w-full space-y-1 pt-3 border-t-2 border-slate-100/80">
                <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">My Stake</span>
                    <span className="text-lg font-extrabold text-blue-700">
                        {parseFloat(formatUnits(userStaked, token.decimals)).toLocaleString(undefined, {maximumFractionDigits: 2})}
                    </span>
                </div>

                <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Staked</span>
                    <span className="text-sm font-bold text-slate-600">
                        {totalStaked ? parseFloat(formatUnits(totalStaked as bigint, token.decimals)).toLocaleString(undefined, {maximumFractionDigits: 0, notation: "compact"}) : '0'}
                    </span>
                </div>
                
                <div className="bg-slate-50 rounded-xl p-3 mt-2 border border-slate-200 flex justify-between items-center">
                    <div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Pending Earn</div>
                        <div className={`text-lg font-extrabold ${hasReward ? 'text-orange-600' : 'text-slate-400'}`}>
                             {pendingReward ? parseFloat(formatEther(pendingReward as bigint)).toFixed(6) : '0.00'}
                             <span className="text-[10px] ml-1 text-slate-400">ABronze</span>
                        </div>
                    </div>
                    
                    {hasReward && (
                        <button 
                            onClick={handleCardClaim}
                            disabled={isClaiming}
                            className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-70 flex items-center gap-1"
                        >
                            {isClaiming ? <Loader2 size={14} className="animate-spin" /> : "Claim"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const StakingSection = () => {
    const { address, isConnected } = useAccount();
    const [stakeToken, setStakeToken] = useState("USDT");
    const [amount, setAmount] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [mode, setMode] = useState<'STAKE' | 'WITHDRAW'>('STAKE');
    const { writeContractAsync } = useWriteContract();

    const STAKING_READ_ABI = [
        { "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "pools", "outputs": [{ "internalType": "uint256", "name": "lastRewardTime", "type": "uint256" }, { "internalType": "uint256", "name": "accRewardPerShare", "type": "uint256" }, { "internalType": "uint256", "name": "rewardPerSecond", "type": "uint256" }, { "internalType": "uint256", "name": "totalStaked", "type": "uint256" }], "stateMutability": "view", "type": "function" },
        { "inputs": [{ "internalType": "address", "name": "", "type": "address" }, { "internalType": "address", "name": "", "type": "address" }], "name": "userInfo", "outputs": [{ "internalType": "uint256", "name": "amount", "type": "uint256" }, { "internalType": "uint256", "name": "rewardDebt", "type": "uint256" }], "stateMutability": "view", "type": "function" },
        { "inputs": [{ "internalType": "address", "name": "token", "type": "address" }, { "internalType": "address", "name": "userAddr", "type": "address" }], "name": "calculatePendingReward", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }
    ];

    const { data: walletRewardBalance } = useReadContract({
        address: TOKENS["ABronze"].address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
    });

    const handleAction = async () => {
        if (!isConnected || !amount) return;
        setIsProcessing(true);
        try {
            const tokenConfig = TOKENS[stakeToken];
            const amountWei = parseUnits(amount, tokenConfig.decimals);

            if (mode === 'STAKE') {
                if (tokenConfig.address === "NATIVE") { alert("Native ETH not supported."); setIsProcessing(false); return; }
                await writeContractAsync({ address: tokenConfig.address as `0x${string}`, abi: ERC20_ABI, functionName: 'approve', args: [STAKING_ADDRESS as `0x${string}`, amountWei] });
                await writeContractAsync({ address: STAKING_ADDRESS as `0x${string}`, abi: [{ "inputs": [{ "internalType": "address", "name": "token", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "stake", "outputs": [], "stateMutability": "nonpayable", "type": "function" }], functionName: 'stake', args: [tokenConfig.address as `0x${string}`, amountWei] });
                alert("✅ Stake Success!");
            } else {
                await writeContractAsync({ address: STAKING_ADDRESS as `0x${string}`, abi: [{ "inputs": [{ "internalType": "address", "name": "token", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "withdraw", "outputs": [], "stateMutability": "nonpayable", "type": "function" }], functionName: 'withdraw', args: [tokenConfig.address as `0x${string}`, amountWei] });
                alert("✅ Withdraw Success!");
            }
            setAmount("");
        } catch (error) { console.error(error); alert("❌ Transaction Failed"); } finally { setIsProcessing(false); }
    };

    return (
        <div className="max-w-6xl mx-auto animate-in fade-in pb-20">
            <div className="bg-gradient-to-r from-[#78350f] to-[#b45309] rounded-3xl p-8 text-white mb-10 shadow-2xl relative overflow-hidden">
                <div className="flex items-center gap-6 relative z-10">
                    <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/20"><div className="text-6xl">🥉</div></div>
                    <div>
                        <div className="text-orange-200 font-bold mb-1 uppercase tracking-wider text-sm">Your Wallet Balance</div>
                        <div className="text-5xl font-extrabold mb-2 text-yellow-300 drop-shadow-lg">
                            {walletRewardBalance ? parseFloat(formatEther(walletRewardBalance as bigint)).toFixed(2) : '0.00'} <span className="text-2xl font-normal text-white ml-2">ABronze</span>
                        </div>
                        <div className="text-sm opacity-80 flex items-center gap-2"><Zap size={14}/> Claim individual rewards from the cards below</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-7 bg-white rounded-3xl p-6 shadow-xl border border-slate-100">
                    <h3 className="text-xl font-bold mb-6 text-[#0f172a] flex items-center gap-2"><LayoutGrid size={20} className="text-blue-600"/> Staking Pools</h3>
                    <div className="grid grid-cols-1 gap-4">
                        {["ADS", "ETH", "DAI", "USDT", "USDC", "EURS", "AAVE", "LINK", "WBTC"].map(t => (
                            <TokenOptionCard 
                                key={t}
                                tokenKey={t}
                                isSelected={stakeToken === t}
                                onClick={setStakeToken}
                                userAddress={address}
                                STAKING_ADDRESS={STAKING_ADDRESS}
                                STAKING_READ_ABI={STAKING_READ_ABI}
                            />
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-5 flex flex-col gap-6">
                    <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100 h-full sticky top-24">
                        <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
                            <button onClick={() => setMode('STAKE')} className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${mode === 'STAKE' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Deposit</button>
                            <button onClick={() => setMode('WITHDRAW')} className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${mode === 'WITHDRAW' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Withdraw</button>
                        </div>
                        <h3 className="text-xl font-bold mb-6 text-[#0f172a]">{mode === 'STAKE' ? `Stake ${stakeToken}` : `Unstake ${stakeToken}`}</h3>
                        <div className="space-y-6">
                            <div className="relative">
                                <input type="number" value={amount} onChange={(e)=>setAmount(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 pl-4 pr-20 text-2xl font-bold outline-none focus:border-blue-500 transition-all text-slate-900" placeholder="0.00" />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">{stakeToken}</div>
                            </div>
                            <button onClick={handleAction} disabled={!isConnected || isProcessing || !amount} className={`w-full text-white py-4 rounded-xl font-bold shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${mode === 'STAKE' ? 'bg-[#0f172a] hover:bg-[#1e293b]' : 'bg-orange-600 hover:bg-orange-700'}`}>
                                {isProcessing ? <Loader2 className="animate-spin" /> : <Wallet size={20} />}
                                {mode === 'STAKE' ? `Approve & Stake` : `Confirm Withdraw`}
                            </button>
                             <p className="text-xs text-center text-slate-400 mt-2">
                                {mode === 'WITHDRAW' ? "* Rewards will be claimed automatically when withdrawing." : ""}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- POOLS SECTION ---
const PoolsSection = () => {
    const pools = [
        { pair: "ADS - USDT", reward: "ABronze", apr: "320%" },
        { pair: "1narai - USDT", reward: "ABronze", apr: "300%" },
        { pair: "ETH - USDT", reward: "ABronze", apr: "15%" },
        { pair: "WBTC - ETH", reward: "ABronze", apr: "12%" },
        { pair: "AAVE - DAI", reward: "ABronze", apr: "25%" },
    ];

    return (
        <div className="max-w-6xl mx-auto pb-20">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">Liquidity Pools <span className="text-sm bg-orange-100 text-orange-700 px-2 py-1 rounded-full">Earn ABronze 🥉</span></h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pools.map((pool, idx) => (
                    <div key={idx} className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="font-bold text-lg">{pool.pair}</h3>
                            <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">{pool.apr} APR</span>
                        </div>
                        <div className="space-y-2 text-sm text-slate-600 mb-6">
                            <div className="flex justify-between"><span>Reward:</span> <span className="font-bold text-orange-600 flex items-center gap-1">🥉 {pool.reward}</span></div>
                            <div className="flex justify-between"><span>Liquidity:</span> <span className="font-bold">$1,204,500</span></div>
                        </div>
                        <button className="w-full border border-blue-600 text-blue-600 font-bold py-2 rounded-lg hover:bg-blue-50">Add Liquidity</button>
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
          <div className="flex items-center gap-3 cursor-pointer" onClick={()=>setActiveMenu('Swap')}>
            <img src="img/logo200.png" alt="Logo" className="w-10 h-10 object-contain" />
            <span className="text-xl font-bold tracking-tight">Onenarai <span className="text-blue-400">DEX</span></span>
          </div>
          <nav className="hidden md:flex gap-1 text-sm font-medium text-slate-400">
            {['Swap', 'Marketplace', 'Staking', 'Pools Liquidity'].map((item) => (
              <button key={item} onClick={() => setActiveMenu(item)} className={`px-4 py-2 rounded-lg transition-all ${activeMenu === item ? 'bg-slate-800 text-white' : 'hover:text-white'}`}>{item}</button>
            ))}
          </nav>
          <div className="flex items-center gap-4">
              <ConnectButton showBalance={false} chainStatus="icon" accountStatus="avatar" />
              <button className="md:hidden p-2" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
          </div>
        </div>
        {isMobileMenuOpen && (
            <div className="md:hidden bg-[#0f172a] border-b border-slate-800 p-4 absolute w-full">
                {['Swap', 'Marketplace', 'Staking', 'Pools Liquidity'].map((item) => (
                    <button key={item} onClick={() => { setActiveMenu(item); setIsMobileMenuOpen(false); }} className="block w-full text-left p-3 text-slate-300 hover:text-white font-bold">{item}</button>
                ))}
            </div>
        )}
      </header>
      <main className="container mx-auto px-4 py-8">{renderContent()}</main>
    </div>
  );
}