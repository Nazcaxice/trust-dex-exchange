'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWriteContract, usePublicClient, useChainId, useSwitchChain } from 'wagmi';
import { parseUnits, parseAbi } from 'viem';
import { supabase } from '@/lib/supabaseClient';
import { 
    ShoppingBag, Plus, CreditCard, X, CheckCircle, 
    Loader2, Crown, Settings, MapPin, Minus, Trash2,
    FileText, Clock, ExternalLink, Eye, User, List, ArrowRight, Copy, ArrowLeft, Printer,
    Wallet, RefreshCw, AlertTriangle, XCircle
} from 'lucide-react';

// ==========================================
// CONFIGURATION
// ==========================================
const MERCHANT_WALLET = "0xA9b549c00E441A8043eDc267245ADF12533611b4";
const BLOCK_EXPLORER = "https://sepolia.etherscan.io/tx/"; 
const EXCHANGE_RATES: Record<string, number> = { "THB": 1, "USDT": 34.5, "ADS": 10.0, "ETH": 85000 };
const TARGET_CHAIN_ID = 11155111; 

const TOKENS: Record<string, { address: string; decimals: number }> = {
    "USDT": { address: "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0", decimals: 6 },
    "ADS":  { address: "0xA3b1173bcba20Cf8E6200fDd4ba673DE9efE588C", decimals: 18 },
    "ETH":  { address: "NATIVE", decimals: 18 }
};
const ERC20_ABI = parseAbi(["function transfer(address to, uint256 amount) returns (bool)"]);

type Product = { id: number; name: string; price_thb: number; image_url: string; };
type UserProfile = { wallet_address: string; name: string; points: number; tier: string; phone: string; shipping_address: string; };
type CartItem = Product & { quantity: number };

export default function MallPage() {
    const { address, isConnected } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();
    const chainId = useChainId();
    const { switchChain } = useSwitchChain();

    // State
    const [products, setProducts] = useState<Product[]>([]);
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [view, setView] = useState<'SHOP' | 'MY_ORDERS'>('SHOP');
    const [myOrders, setMyOrders] = useState<any[]>([]);
    const [isLoadingMyOrders, setIsLoadingMyOrders] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [addingId, setAddingId] = useState<number | null>(null);
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [checkoutStep, setCheckoutStep] = useState(1);
    const [shippingInfo, setShippingInfo] = useState({ name: '', address: '', phone: '' });
    const [selectedToken, setSelectedToken] = useState("USDT");
    const [isProcessing, setIsProcessing] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");
    const [currentTxHash, setCurrentTxHash] = useState("");

    // Effect: Resume Transaction
    useEffect(() => {
        const pendingHash = localStorage.getItem('pendingTxHash');
        const pendingCart = localStorage.getItem('pendingCart');
        
        if (pendingHash && pendingCart) {
            setCurrentTxHash(pendingHash);
            setCart(JSON.parse(pendingCart));
            setIsCheckoutOpen(true);
            setCheckoutStep(2);
            setStatusMessage("Found pending transaction. Please check status.");
            setIsProcessing(true); 
        }
    }, []);

    const fetchProducts = async () => {
        setIsLoadingData(true);
        const { data, error } = await supabase.from('products').select('*').order('id', { ascending: false });
        if (!error) setProducts(data || []);
        setIsLoadingData(false);
    };

    const fetchUser = async () => {
        if (!address) return;
        const { data } = await supabase.from('users').select('*').eq('wallet_address', address).single();
        if (data) {
            setCurrentUser(data);
            setShippingInfo({ name: data.name || '', address: data.shipping_address || '', phone: data.phone || '' });
        } else {
            const newUser = { wallet_address: address, name: `User ${address.slice(0,6)}`, points: 0, tier: 'Silver' };
            await supabase.from('users').insert([newUser]);
            setCurrentUser(newUser as UserProfile);
        }
    };

    const fetchMyOrders = async () => {
        if (!address) return;
        setIsLoadingMyOrders(true);
        const { data } = await supabase.from('orders')
            .select('*')
            .eq('buyer_wallet', address)
            .order('created_at', { ascending: false });
        setMyOrders(data || []);
        setIsLoadingMyOrders(false);
    };

    useEffect(() => { fetchProducts(); }, []);
    useEffect(() => { if (isConnected && address) fetchUser(); else setCurrentUser(null); }, [isConnected, address]);

    const addToCart = (product: Product) => {
        setCart(prev => {
            const exist = prev.find(p => p.id === product.id);
            return exist ? prev.map(p => p.id === product.id ? { ...p, quantity: p.quantity + 1 } : p) : [...prev, { ...product, quantity: 1 }];
        });
        setAddingId(product.id);
        setTimeout(() => setAddingId(null), 500);
    };
    const removeFromCart = (productId: number) => setCart(prev => prev.filter(p => p.id !== productId));
    const updateQuantity = (productId: number, delta: number) => {
        setCart(prev => prev.map(p => {
            if (p.id === productId) { const newQty = p.quantity + delta; return newQty > 0 ? { ...p, quantity: newQty } : p; }
            return p;
        }));
    };
    const handleCopy = (text: string, fieldId: string) => {
        if (!text) return; navigator.clipboard.writeText(text); setCopiedField(fieldId); setTimeout(() => setCopiedField(null), 2000);
    };

    const cartTotalTHB = cart.reduce((sum, item) => sum + (item.price_thb * item.quantity), 0);
    const discountTHB = 0; 
    const finalPriceTHB = cartTotalTHB - discountTHB;
    const cryptoPrice = (finalPriceTHB / EXCHANGE_RATES[selectedToken]).toFixed(6);

    // ✅ SAVE ORDER (Updated with Duplicate Check)
    const saveOrderToDb = async (txHash: string) => {
        try {
            setStatusMessage("Checking for duplicates...");

            // 1. เช็คก่อนว่ามี Order นี้อยู่แล้วหรือไม่ (ป้องกันการบันทึกซ้ำ)
            const { data: existingOrders } = await supabase
                .from('orders')
                .select('id')
                .eq('tx_hash', txHash); // ใช้ .select() ธรรมดาแล้วเช็ค length จะชัวร์กว่า .single() ในบางกรณี

            if (existingOrders && existingOrders.length > 0) {
                console.log("Order already exists, skipping save.");
                // ถ้ามีแล้ว ให้ข้ามการบันทึก แล้วเคลียร์ State ถือว่าสำเร็จเลย
                localStorage.removeItem('pendingTxHash');
                localStorage.removeItem('pendingCart');
                setCart([]); 
                setCurrentTxHash(""); 
                setStatusMessage(""); 
                setCheckoutStep(3); 
                setIsProcessing(false);
                return; // ⛔ จบฟังก์ชันทันที
            }

            // 2. ถ้ายังไม่มี ให้บันทึกตามปกติ
            setStatusMessage("Payment confirmed! Saving order...");
            const earnedPoints = Math.floor(finalPriceTHB / 100);
            const newPoints = (currentUser?.points || 0) + earnedPoints;
            let newTier = newPoints > 5000 ? 'Platinum' : newPoints > 1000 ? 'Gold' : 'Silver';

            const { error } = await supabase.from('orders').insert([{
                buyer_wallet: address, items: cart, total_thb: cartTotalTHB, discount_thb: discountTHB, final_price_thb: finalPriceTHB,
                payment_token: selectedToken, crypto_amount: parseFloat(cryptoPrice), shipping_info: shippingInfo, status: 'PAID',
                tx_hash: txHash
            }]);
            
            if (error) throw error;
            
            if (address) { 
                await supabase.from('users').update({ 
                    points: newPoints, tier: newTier, phone: shippingInfo.phone, shipping_address: shippingInfo.address 
                }).eq('wallet_address', address); 
                fetchUser(); 
            }

            // Clear Storage
            localStorage.removeItem('pendingTxHash');
            localStorage.removeItem('pendingCart');

            setCart([]); setCurrentTxHash(""); setStatusMessage(""); setCheckoutStep(3); setIsProcessing(false);

        } catch (error: any) {
            console.error("Save DB Error:", error);
            alert("Payment successful but failed to save order: " + error.message);
            setIsProcessing(false);
        }
    };

    // Manual Check
    const handleManualCheck = async () => {
        const hashToCheck = currentTxHash || localStorage.getItem('pendingTxHash');
        if (!hashToCheck) { alert("No pending transaction found."); setIsProcessing(false); return; }
        setCurrentTxHash(hashToCheck); 
        if (!publicClient) return;

        if (chainId !== TARGET_CHAIN_ID) {
            if(confirm(`Wrong Network! Connect to Chain ID ${TARGET_CHAIN_ID}?`)) {
                try { switchChain({ chainId: TARGET_CHAIN_ID }); } catch(e){}
            }
            return; 
        }
        
        setStatusMessage("Checking transaction status... ⏳");
        
        try {
            try {
                const tx = await publicClient.getTransaction({ hash: hashToCheck as `0x${string}` });
                if (!tx) throw new Error("Not found in mempool");
                setStatusMessage("Found! Waiting for confirmation... ⏳");
            } catch (e) { console.log("Tx not in mempool"); }

            const receipt = await publicClient.waitForTransactionReceipt({ 
                hash: hashToCheck as `0x${string}`, timeout: 60_000, pollingInterval: 3_000 
            });

            if (receipt.status === 'success') {
                await saveOrderToDb(hashToCheck);
            } else {
                alert("❌ Transaction FAILED (Reverted)!");
                setStatusMessage("Transaction Failed (Reverted) ❌");
                setIsProcessing(false);
                localStorage.removeItem('pendingTxHash'); 
            }
        } catch (error: any) {
            console.error(error);
            const isTimeout = error.name === 'TimeoutError' || error.message.includes('timed out');
            if (isTimeout) {
                alert("⏳ Network slow. Please wait 30s and check again.");
                setStatusMessage("Pending... check again later.");
            } else {
                alert("Error checking: " + (error.message || "Unknown error"));
                setStatusMessage("Check failed.");
            }
        }
    };

    const handleCheckout = async () => {
        if (!isConnected) { alert("Please Connect Wallet"); return; }
        if (!shippingInfo.name || !shippingInfo.address) { alert("Please fill shipping details"); setCheckoutStep(1); return; }
        
        if (chainId !== TARGET_CHAIN_ID) {
            alert(`Wrong Network. Switching to ${TARGET_CHAIN_ID}...`);
            switchChain({ chainId: TARGET_CHAIN_ID });
            return;
        }

        setIsProcessing(true);
        setStatusMessage("Please confirm transaction...");
        setCurrentTxHash(""); 
        localStorage.removeItem('pendingTxHash');

        try {
            const tokenConfig = TOKENS[selectedToken];
            const amountWei = parseUnits(cryptoPrice, tokenConfig.decimals);
            
            let txHash = "";
            if (selectedToken !== "ETH") {
                txHash = await writeContractAsync({ 
                    address: tokenConfig.address as `0x${string}`, 
                    abi: ERC20_ABI, 
                    functionName: 'transfer', 
                    args: [MERCHANT_WALLET, amountWei] 
                });
            } else {
                alert("ETH payment implementation required sendTransaction hook"); setIsProcessing(false); return;
            }

            if (txHash) {
                localStorage.setItem('pendingTxHash', txHash);
                localStorage.setItem('pendingCart', JSON.stringify(cart));
                setCurrentTxHash(txHash);

                setStatusMessage("Waiting for confirmation... ⏳");
                
                if (publicClient) {
                    try {
                        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
                        
                        if (receipt.status === 'success') {
                            await saveOrderToDb(txHash);
                        } else {
                            alert("❌ Transaction FAILED (Reverted)!");
                            setStatusMessage("Transaction Failed ❌");
                            setIsProcessing(false);
                            localStorage.removeItem('pendingTxHash');
                        }
                    } catch (e) {
                        console.log("Auto wait failed/timeout, user must click manual check");
                    }
                }
            }
        } catch (error: any) { 
            console.error(error); 
            if (error.message.includes("User rejected")) { setIsProcessing(false); setStatusMessage(""); }
        } 
    };

    const handleClearPending = () => {
        if(confirm("Cancel transaction check?")) {
            localStorage.removeItem('pendingTxHash');
            localStorage.removeItem('pendingCart');
            setCurrentTxHash("");
            setIsProcessing(false);
            setStatusMessage("");
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-20 text-slate-900">
            <header className="bg-white border-b sticky top-0 z-10 px-6 py-4 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-2"><ShoppingBag className="text-orange-600" /><h1 className="text-xl font-bold text-slate-800">Shopping Mall</h1></div>
                <div className="flex items-center gap-4">
                    {isConnected && (<button onClick={() => { setView('MY_ORDERS'); fetchMyOrders(); setSelectedOrder(null); }} className={`flex items-center gap-1 text-xs font-bold transition-colors border px-2 py-1 rounded-lg ${view === 'MY_ORDERS' ? 'bg-slate-900 text-white border-slate-900' : 'text-slate-500 hover:text-blue-600 hover:border-blue-200'}`}><FileText size={14}/> <span className="hidden sm:inline">My Orders</span></button>)}
                    <Link href="/mall/admin" className="hidden md:flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-orange-600 transition-colors border px-2 py-1 rounded-lg"><Settings size={14}/> Admin System</Link>
                    {currentUser && (<div className="hidden md:flex flex-col items-end mr-4"><div className="text-sm font-bold text-slate-800 flex items-center gap-1">{currentUser.tier !== 'Silver' && <Crown size={14} className="text-yellow-500 fill-yellow-500"/>}{currentUser.name}</div><div className="text-xs text-slate-500">{currentUser.points} Points</div></div>)}
                    <ConnectButton showBalance={false} />
                    {view === 'SHOP' && (<button onClick={()=>{setIsCheckoutOpen(true); setCheckoutStep(1);}} className="relative p-2 bg-slate-900 text-white rounded-full hover:bg-slate-700 transition-all"><ShoppingBag size={20} />{cart.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold">{cart.length}</span>}</button>)}
                </div>
            </header>

            <main className="max-w-6xl mx-auto p-6">
                {view === 'SHOP' && (
                    <div className="animate-in fade-in">
                        {isLoadingData ? <div className="text-center py-20 text-slate-500"><Loader2 className="animate-spin mx-auto"/> Loading Products...</div> : (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                {products.map((item) => (
                                    <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm border hover:shadow-lg transition-all group">
                                        <div className="h-40 bg-slate-100 rounded-xl mb-4 overflow-hidden relative"><img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /></div>
                                        <h3 className="font-bold text-slate-800 truncate">{item.name}</h3>
                                        <div className="mt-2 mb-4"><div className="text-orange-600 font-extrabold text-lg">฿{item.price_thb.toLocaleString()}</div><div className="text-xs text-slate-400 mt-1">≈ {(item.price_thb/EXCHANGE_RATES['USDT']).toFixed(2)} USDT</div></div>
                                        <button onClick={()=>addToCart(item)} disabled={addingId === item.id} className={`w-full py-2 rounded-xl font-bold flex items-center justify-center gap-2 text-sm transition-all duration-200 transform active:scale-95 ${addingId === item.id ? "bg-green-500 text-white scale-105 shadow-lg shadow-green-200" : "bg-slate-900 text-white hover:bg-slate-800 hover:shadow-md"}`}>{addingId === item.id ? (<><CheckCircle size={16} className="animate-bounce"/> Added!</>) : (<><Plus size={16}/> Add to Cart</>)}</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {view === 'MY_ORDERS' && (
                    <div className="animate-in fade-in slide-in-from-right duration-300">
                        {selectedOrder ? (
                            <div className="max-w-3xl mx-auto">
                                <div className="flex items-center gap-4 mb-6">
                                    <button onClick={() => setSelectedOrder(null)} className="p-2 bg-white border rounded-full hover:bg-slate-50 transition-colors shadow-sm text-slate-500 hover:text-slate-800"><ArrowLeft size={20} /></button>
                                    <div><h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">Order #{selectedOrder.id}<span className={`px-3 py-1 rounded-full text-sm font-bold ${selectedOrder.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{selectedOrder.status}</span></h1><div className="text-sm text-slate-500 flex items-center gap-2 mt-1"><Clock size={14}/> {new Date(selectedOrder.created_at).toLocaleString()}</div></div>
                                </div>
                                <div className="space-y-6">
                                    <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
                                        <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-2"><List size={20} className="text-orange-500"/> Order Items</h3>
                                        {selectedOrder.items?.map((item:any, i:number) => (<div key={i} className="flex justify-between items-center text-sm p-2 hover:bg-slate-50 rounded-lg transition-colors"><div className="flex items-center gap-4"><img src={item.image_url} className="w-12 h-12 rounded-lg bg-slate-100 border object-cover"/><div><div className="font-bold text-slate-700">{item.name}</div><div className="text-xs text-slate-400">Unit: ฿{item.price_thb.toLocaleString()} x {item.quantity}</div></div></div><div className="font-bold text-slate-900">฿{(item.price_thb * item.quantity).toLocaleString()}</div></div>))}
                                        <div className="pt-2 border-t flex justify-between items-center font-bold text-lg text-slate-900 mt-2"><span>Total</span><span>฿{selectedOrder.final_price_thb.toLocaleString()}</span></div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-3"><h3 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-2"><MapPin size={20} className="text-red-500"/> Shipping</h3><div className="text-sm space-y-1 text-slate-600"><p className="font-bold text-slate-800">{selectedOrder.shipping_info?.name}</p><p>{selectedOrder.shipping_info?.phone}</p><p className="leading-relaxed">{selectedOrder.shipping_info?.address}</p></div></div>
                                        <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-3">
                                            <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-2"><Wallet size={20} className="text-purple-500"/> Payment Info</h3>
                                            <div className="text-sm space-y-3">
                                                <div className="flex justify-between items-center bg-slate-50 p-2 rounded border"><span className="text-slate-500">Paid Amount</span><span className="font-mono font-bold text-purple-700">{selectedOrder.crypto_amount} {selectedOrder.payment_token}</span></div>
                                                <div><span className="text-xs text-slate-400 block mb-1">From (Buyer)</span><div className="flex items-center gap-2"><div className="font-mono text-xs bg-slate-100 p-2 rounded border text-slate-600 truncate flex-1">{selectedOrder.buyer_wallet}</div><button onClick={() => handleCopy(selectedOrder.buyer_wallet, 'buyer')} className="p-2 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-800">{copiedField === 'buyer' ? <CheckCircle size={14} className="text-green-500"/> : <Copy size={14}/>}</button></div></div>
                                                <div><span className="text-xs text-slate-400 block mb-1">To (Merchant)</span><div className="flex items-center gap-2"><div className="font-mono text-xs bg-slate-100 p-2 rounded border text-slate-600 truncate flex-1">{MERCHANT_WALLET}</div><button onClick={() => handleCopy(MERCHANT_WALLET, 'merchant')} className="p-2 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-800">{copiedField === 'merchant' ? <CheckCircle size={14} className="text-green-500"/> : <Copy size={14}/>}</button></div></div>
                                                {selectedOrder.tx_hash && (<div className="pt-2 border-t border-slate-100 mt-2"><span className="text-xs text-slate-400 block mb-1">Transaction Hash</span><div className="flex items-center gap-2"><div className="font-mono text-xs bg-blue-50 p-2 rounded border border-blue-100 text-blue-600 truncate flex-1">{selectedOrder.tx_hash}</div><button onClick={() => handleCopy(selectedOrder.tx_hash, 'tx')} className="p-2 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-800">{copiedField === 'tx' ? <CheckCircle size={14} className="text-green-500"/> : <Copy size={14}/>}</button><a href={`${BLOCK_EXPLORER}${selectedOrder.tx_hash}`} target="_blank" rel="noreferrer" className="p-2 hover:bg-blue-100 rounded text-blue-500 hover:text-blue-700"><ExternalLink size={16}/></a></div></div>)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="max-w-4xl mx-auto">
                                <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><FileText size={28} className="text-blue-600"/> Order History</h2><button onClick={() => setView('SHOP')} className="text-sm font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 border px-3 py-1.5 rounded-lg hover:bg-white hover:shadow-sm transition-all"><ArrowLeft size={16}/> Back to Shop</button></div>
                                {isLoadingMyOrders ? <div className="text-center py-20 text-slate-500"><Loader2 className="animate-spin mx-auto mb-2"/> Loading history...</div> : myOrders.length === 0 ? <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300"><ShoppingBag size={48} className="mx-auto text-slate-300 mb-4"/><p className="text-slate-500 font-bold">No orders found.</p><p className="text-xs text-slate-400">Your purchase history will appear here.</p></div> : (
                                    <div className="space-y-4">
                                        {myOrders.map((order) => (
                                            <div key={order.id} className="bg-white p-5 rounded-2xl border shadow-sm hover:shadow-md transition-all group">
                                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4 mb-4">
                                                    <div>
                                                        <div className="font-bold text-lg text-slate-800 flex items-center gap-2">Order #{order.id}<span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold border border-green-200">{order.status}</span></div>
                                                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-1"><Clock size={12}/> {new Date(order.created_at).toLocaleString()}</div>
                                                    </div>
                                                    <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                                                        <div className="text-right"><div className="text-xs text-slate-400">Total Amount</div><div className="font-extrabold text-slate-900 text-lg">฿{order.final_price_thb.toLocaleString()}</div></div>
                                                        <div className="flex gap-2">
                                                            {order.tx_hash && (<a href={`${BLOCK_EXPLORER}${order.tx_hash}`} target="_blank" rel="noreferrer" className="bg-slate-100 text-slate-500 px-3 py-2 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors flex items-center gap-1" title="View Transaction"><ExternalLink size={16}/></a>)}
                                                            <button onClick={() => setSelectedOrder(order)} className="bg-slate-900 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-slate-700 transition-colors flex items-center gap-2 shadow-lg shadow-slate-200">View <ArrowRight size={16}/></button>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">{order.items.map((item:any, i:number) => (<div key={i} className="flex-shrink-0 w-16 h-16 relative group/item"><img src={item.image_url} className="w-full h-full rounded-lg object-cover border bg-slate-50"/><span className="absolute -top-1 -right-1 bg-slate-900 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-white font-bold">{item.quantity}</span></div>))}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* CHECKOUT MODAL */}
            {isCheckoutOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm text-slate-900">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="bg-slate-50 p-4 border-b flex justify-between items-center">
                            <h2 className="font-bold text-lg text-slate-800">Checkout Step {checkoutStep}/3</h2>
                            <button onClick={()=>{setIsCheckoutOpen(false); setCurrentTxHash(""); setIsProcessing(false);}} className="text-slate-500 hover:text-slate-800"><X size={20}/></button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1">
                            {checkoutStep === 1 && (
                                <div className="space-y-6">
                                    <div><h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><ShoppingBag size={18}/> Order Summary</h3><div className="bg-slate-50 rounded-xl border p-2 space-y-2 max-h-48 overflow-y-auto">{cart.length === 0 ? <p className="text-center text-slate-400 text-sm py-4">Your cart is empty.</p> : cart.map((item) => (<div key={item.id} className="flex items-center justify-between p-3 bg-white rounded-lg border shadow-sm"><div className="flex items-center gap-3"><img src={item.image_url} className="w-12 h-12 rounded-md object-cover bg-slate-100 border"/><div><div className="text-xs font-bold text-slate-800 truncate w-24 sm:w-32">{item.name}</div><div className="text-[10px] text-slate-500 mb-1">฿{item.price_thb.toLocaleString()} / unit</div><div className="flex items-center gap-1"><button onClick={()=>updateQuantity(item.id, -1)} className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-600 border"><Minus size={12}/></button><span className="text-xs font-bold w-6 text-center">{item.quantity}</span><button onClick={()=>updateQuantity(item.id, 1)} className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-600 border"><Plus size={12}/></button></div></div></div><div className="flex flex-col items-end gap-2"><div className="font-bold text-sm text-slate-900">฿{(item.price_thb * item.quantity).toLocaleString()}</div><button onClick={()=>removeFromCart(item.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 rounded transition-colors"><Trash2 size={16}/></button></div></div>))}</div>{cart.length > 0 && (<div className="flex justify-between items-center mt-2 px-2"><span className="text-xs font-bold text-slate-500">Subtotal</span><span className="text-sm font-extrabold text-slate-800">฿{cartTotalTHB.toLocaleString()}</span></div>)}</div>
                                    <div className="border-t pt-4"><h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><MapPin size={18}/> Shipping Details</h3><div className="space-y-3"><div><label className="text-xs font-bold text-slate-500 ml-1">Receiver Name</label><input type="text" value={shippingInfo.name} onChange={e=>setShippingInfo({...shippingInfo, name: e.target.value})} className="w-full border rounded-xl p-3 bg-white text-slate-900 placeholder:text-slate-400 text-sm font-bold" placeholder="Full Name"/></div><div><label className="text-xs font-bold text-slate-500 ml-1">Phone Number</label><input type="tel" value={shippingInfo.phone} onChange={e=>setShippingInfo({...shippingInfo, phone: e.target.value})} className="w-full border rounded-xl p-3 bg-white text-slate-900 placeholder:text-slate-400 text-sm font-bold" placeholder="08x-xxx-xxxx"/></div><div><label className="text-xs font-bold text-slate-500 ml-1">Address</label><textarea value={shippingInfo.address} onChange={e=>setShippingInfo({...shippingInfo, address: e.target.value})} className="w-full border rounded-xl p-3 bg-white text-slate-900 placeholder:text-slate-400 text-sm" rows={3} placeholder="House No, Street, City, Zip Code..."></textarea></div></div></div>
                                </div>
                            )}
                            {checkoutStep === 2 && (
                                <div className="space-y-4">
                                    <div className="flex justify-between font-bold text-lg"><span className="text-slate-600">Total Amount</span><span className="text-orange-600">฿{finalPriceTHB.toLocaleString()}</span></div>
                                    <div className="grid grid-cols-3 gap-2">{Object.keys(TOKENS).map(token => (<button key={token} onClick={()=>setSelectedToken(token)} className={`py-3 rounded-xl border font-bold text-sm ${selectedToken===token ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}>{token}</button>))}</div>
                                    <div className="bg-orange-50 p-4 rounded-xl text-center"><div className="text-sm text-orange-800">You Pay</div><div className="text-2xl font-extrabold text-slate-900">{cryptoPrice} {selectedToken}</div></div>
                                    
                                    {/* ✅ แสดง Tx Hash พร้อมปุ่ม Copy */}
                                    {currentTxHash && (
                                        <div className="mt-3">
                                            <label className="text-xs text-slate-400 block text-left mb-1">Transaction Hash (Debug):</label>
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="text" 
                                                    value={currentTxHash} 
                                                    readOnly 
                                                    className="w-full p-2 text-xs border rounded-lg bg-slate-100 text-slate-600 font-mono focus:outline-none"
                                                />
                                                <button onClick={() => handleCopy(currentTxHash, 'debug_tx')} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors" title="Copy Hash">{copiedField === 'debug_tx' ? <CheckCircle size={16} className="text-green-500"/> : <Copy size={16}/>}</button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Manual Check Button */}
                                    {currentTxHash && isProcessing && (
                                        <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-xl text-center">
                                            <p className="text-xs text-blue-600 mb-2 flex items-center justify-center gap-1"><AlertTriangle size={12}/> If paid but stuck, click below:</p>
                                            <div className="flex flex-col gap-2">
                                                <button onClick={handleManualCheck} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 w-full flex items-center justify-center gap-2"><RefreshCw size={16}/> Check Status (Force)</button>
                                                <button onClick={handleClearPending} className="text-red-400 text-xs hover:text-red-600 underline">Cancel / Reset</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            {checkoutStep === 3 && (
                                <div className="text-center py-10"><CheckCircle size={64} className="text-green-500 mx-auto mb-4"/><h3 className="text-2xl font-bold text-slate-800">Success!</h3><p className="text-slate-500">Transaction Confirmed & Order Saved.</p></div>
                            )}
                        </div>
                        <div className="p-4 border-t bg-slate-50 flex gap-3">
                            {checkoutStep === 1 && <button onClick={()=>setCheckoutStep(2)} disabled={cart.length === 0} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors">Next</button>}
                            {checkoutStep === 2 && <button onClick={handleCheckout} disabled={isProcessing} className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold disabled:opacity-70 flex justify-center items-center gap-2">{isProcessing ? <><Loader2 className="animate-spin" size={18}/> {statusMessage || "Processing..."}</> : "Pay Now"}</button>}
                            {checkoutStep === 3 && <button onClick={()=>{setIsCheckoutOpen(false); setCheckoutStep(1);}} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold">Close</button>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}