'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link'; // ✅ Import Link
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWriteContract } from 'wagmi';
import { parseUnits, parseAbi } from 'viem';
import { supabase } from '@/lib/supabaseClient';
import { 
    ShoppingBag, Plus, CreditCard, X, CheckCircle, 
    Loader2, Crown, Settings, MapPin 
} from 'lucide-react';

// ==========================================
// CONFIGURATION (เหมือนเดิม)
// ==========================================
const MERCHANT_WALLET = "0xA9b549c00E441A8043eDc267245ADF12533611b4"; // ⚠️ แก้เป็น Wallet คุณ
const EXCHANGE_RATES: Record<string, number> = { "THB": 1, "USDT": 34.5, "ADS": 10.0, "ETH": 85000 };
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

    // State
    const [products, setProducts] = useState<Product[]>([]);
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    
    // Checkout State
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [checkoutStep, setCheckoutStep] = useState(1);
    const [shippingInfo, setShippingInfo] = useState({ name: '', address: '', phone: '' });
    const [selectedToken, setSelectedToken] = useState("USDT");
    const [isProcessing, setIsProcessing] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false);

    // Fetch Data
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

    useEffect(() => { fetchProducts(); }, []);
    useEffect(() => { if (isConnected && address) fetchUser(); else setCurrentUser(null); }, [isConnected, address]);

    // Actions
    const addToCart = (product: Product) => setCart(prev => {
        const exist = prev.find(p => p.id === product.id);
        return exist ? prev.map(p => p.id === product.id ? { ...p, quantity: p.quantity + 1 } : p) : [...prev, { ...product, quantity: 1 }];
    });

    const cartTotalTHB = cart.reduce((sum, item) => sum + (item.price_thb * item.quantity), 0);
    const discountTHB = currentUser?.tier === 'Gold' ? cartTotalTHB * 0.05 : currentUser?.tier === 'Platinum' ? cartTotalTHB * 0.10 : 0;
    const finalPriceTHB = cartTotalTHB - discountTHB;
    const cryptoPrice = (finalPriceTHB / EXCHANGE_RATES[selectedToken]).toFixed(6);

    const handleCheckout = async () => {
        if (!isConnected) { alert("Please Connect Wallet"); return; }
        if (!shippingInfo.name || !shippingInfo.address) { alert("Please fill shipping details"); setCheckoutStep(1); return; }
        setIsProcessing(true);
        try {
            const tokenConfig = TOKENS[selectedToken];
            const amountWei = parseUnits(cryptoPrice, tokenConfig.decimals);
            if (selectedToken !== "ETH") {
                await writeContractAsync({ address: tokenConfig.address as `0x${string}`, abi: ERC20_ABI, functionName: 'transfer', args: [MERCHANT_WALLET, amountWei] });
            }
            const earnedPoints = Math.floor(finalPriceTHB / 100);
            const newPoints = (currentUser?.points || 0) + earnedPoints;
            let newTier = newPoints > 5000 ? 'Platinum' : newPoints > 1000 ? 'Gold' : 'Silver';

            const { error } = await supabase.from('orders').insert([{
                buyer_wallet: address, items: cart, total_thb: cartTotalTHB, discount_thb: discountTHB, final_price_thb: finalPriceTHB,
                payment_token: selectedToken, crypto_amount: parseFloat(cryptoPrice), shipping_info: shippingInfo, status: 'PAID'
            }]);
            if (error) throw error;
            if (address) { await supabase.from('users').update({ points: newPoints, tier: newTier, phone: shippingInfo.phone, shipping_address: shippingInfo.address }).eq('wallet_address', address); fetchUser(); }
            setCart([]); setCheckoutStep(3);
        } catch (error: any) { console.error(error); alert("Checkout Failed: " + error.message); } 
        finally { setIsProcessing(false); }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-20 text-slate-900">
            {/* Header */}
            <header className="bg-white border-b sticky top-0 z-10 px-6 py-4 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-2">
                    <ShoppingBag className="text-orange-600" />
                    <h1 className="text-xl font-bold text-slate-800">Shopping Mall</h1>
                </div>
                <div className="flex items-center gap-4">
                    {/* Link ไปหน้า Admin */}
                    <Link href="/mall/admin" className="hidden md:flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-orange-600 transition-colors border px-2 py-1 rounded-lg">
                        <Settings size={14}/> Admin System
                    </Link>

                    {currentUser && (
                        <div className="hidden md:flex flex-col items-end mr-4">
                            <div className="text-sm font-bold text-slate-800 flex items-center gap-1">
                                {currentUser.tier !== 'Silver' && <Crown size={14} className="text-yellow-500 fill-yellow-500"/>}
                                {currentUser.name}
                            </div>
                            <div className="text-xs text-slate-500">{currentUser.points} Points</div>
                        </div>
                    )}
                    
                    <ConnectButton showBalance={false} />
                    
                    <button onClick={()=>{setIsCheckoutOpen(true); setCheckoutStep(1);}} className="relative p-2 bg-slate-900 text-white rounded-full hover:bg-slate-700 transition-all">
                        <ShoppingBag size={20} />
                        {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold">{cart.length}</span>}
                    </button>
                </div>
            </header>

            <main className="max-w-6xl mx-auto p-6">
                <div className="animate-in fade-in">
                    {isLoadingData ? <div className="text-center py-20 text-slate-500"><Loader2 className="animate-spin mx-auto"/> Loading Products...</div> : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            {products.map((item) => (
                                <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm border hover:shadow-lg transition-all group">
                                    <div className="h-40 bg-slate-100 rounded-xl mb-4 overflow-hidden relative">
                                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                    </div>
                                    <h3 className="font-bold text-slate-800 truncate">{item.name}</h3>
                                    <div className="flex justify-between items-end mt-2 mb-4">
                                        <div className="text-orange-600 font-extrabold text-lg">฿{item.price_thb.toLocaleString()}</div>
                                        <div className="text-xs text-slate-400">≈ {(item.price_thb/EXCHANGE_RATES['USDT']).toFixed(2)} USDT</div>
                                    </div>
                                    <button onClick={()=>addToCart(item)} className="w-full bg-slate-900 text-white py-2 rounded-xl font-bold hover:bg-slate-800 flex items-center justify-center gap-2 text-sm">
                                        <Plus size={16}/> Add to Cart
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* CHECKOUT MODAL (Code เดิม) */}
            {isCheckoutOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm text-slate-900">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="bg-slate-50 p-4 border-b flex justify-between items-center">
                            <h2 className="font-bold text-lg text-slate-800">Checkout Step {checkoutStep}/3</h2>
                            <button onClick={()=>setIsCheckoutOpen(false)} className="text-slate-500 hover:text-slate-800"><X size={20}/></button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1">
                            {checkoutStep === 1 && (
                                <div className="space-y-4">
                                    <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-800 font-bold">Total: ฿{cartTotalTHB.toLocaleString()}</div>
                                    <input type="text" value={shippingInfo.name} onChange={e=>setShippingInfo({...shippingInfo, name: e.target.value})} className="w-full border rounded-xl p-3 bg-white text-slate-900 placeholder:text-slate-400" placeholder="Receiver Name"/>
                                    <input type="tel" value={shippingInfo.phone} onChange={e=>setShippingInfo({...shippingInfo, phone: e.target.value})} className="w-full border rounded-xl p-3 bg-white text-slate-900 placeholder:text-slate-400" placeholder="Phone Number"/>
                                    <textarea value={shippingInfo.address} onChange={e=>setShippingInfo({...shippingInfo, address: e.target.value})} className="w-full border rounded-xl p-3 bg-white text-slate-900 placeholder:text-slate-400" rows={3} placeholder="Address"></textarea>
                                </div>
                            )}
                            {checkoutStep === 2 && (
                                <div className="space-y-4">
                                    <div className="flex justify-between font-bold text-lg">
                                        <span className="text-slate-600">Total (after discount)</span>
                                        <span className="text-orange-600">฿{finalPriceTHB.toLocaleString()}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        {Object.keys(TOKENS).map(token => (
                                            <button key={token} onClick={()=>setSelectedToken(token)} className={`py-3 rounded-xl border font-bold text-sm ${selectedToken===token ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}>{token}</button>
                                        ))}
                                    </div>
                                    <div className="bg-orange-50 p-4 rounded-xl text-center">
                                        <div className="text-sm text-orange-800">You Pay</div>
                                        <div className="text-2xl font-extrabold text-slate-900">{cryptoPrice} {selectedToken}</div>
                                    </div>
                                </div>
                            )}
                            {checkoutStep === 3 && (
                                <div className="text-center py-10">
                                    <CheckCircle size={64} className="text-green-500 mx-auto mb-4"/>
                                    <h3 className="text-2xl font-bold text-slate-800">Success!</h3>
                                    <p className="text-slate-500">Order saved to Supabase.</p>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t bg-slate-50 flex gap-3">
                            {checkoutStep === 1 && <button onClick={()=>setCheckoutStep(2)} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold">Next</button>}
                            {checkoutStep === 2 && <button onClick={handleCheckout} disabled={isProcessing} className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold">{isProcessing ? "Processing..." : "Pay Now"}</button>}
                            {checkoutStep === 3 && <button onClick={()=>{setIsCheckoutOpen(false); setCheckoutStep(1);}} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold">Close</button>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}