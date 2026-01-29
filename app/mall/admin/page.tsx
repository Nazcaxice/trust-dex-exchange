'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { 
    LayoutDashboard, Plus, List, Loader2, UploadCloud, 
    ArrowLeft, CheckCircle, Package, Trash2, Edit, X, Save,
    Users, Wallet, Lock, Key, LogIn, User, Shield, ShieldAlert,
    Eye, MapPin, Phone, Calendar, CreditCard, ArrowRight, Printer, Copy, ExternalLink,
    RefreshCw // ✅ Import ไอคอน Refresh
} from 'lucide-react';

const MERCHANT_WALLET = "0xA9b549c00E441A8043eDc267245ADF12533611b4";
const BLOCK_EXPLORER = "https://testnet.bscscan.com/tx/"; 

export default function AdminPage() {
    // --- AUTH STATE ---
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentAdmin, setCurrentAdmin] = useState<any>(null); 
    const [usernameInput, setUsernameInput] = useState("");
    const [passwordInput, setPasswordInput] = useState("");
    const [loginError, setLoginError] = useState("");
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    // --- DASHBOARD STATE ---
    const [activeTab, setActiveTab] = useState<'PRODUCTS' | 'ORDERS' | 'MEMBERS' | 'ADMINS'>('PRODUCTS');
    const [orders, setOrders] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [members, setMembers] = useState<any[]>([]);
    const [admins, setAdmins] = useState<any[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false); // ✅ State สำหรับอนิเมชั่น Refresh
    
    // State View Detail
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    // --- FORMS STATE ---
    const [prodId, setProdId] = useState<number | null>(null);
    const [prodName, setProdName] = useState("");
    const [prodPrice, setProdPrice] = useState("");
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [oldImageUrl, setOldImageUrl] = useState<string | null>(null);

    const [adminId, setAdminId] = useState<number | null>(null);
    const [newAdminUser, setNewAdminUser] = useState("");
    const [newAdminPass, setNewAdminPass] = useState("");
    const [newAdminRole, setNewAdminRole] = useState("admin");

    // --- FETCH DATA ---
    const fetchData = async () => {
        setIsRefreshing(true); // เริ่มหมุน
        const { data: orderData } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
        setOrders(orderData || []);
        const { data: productData } = await supabase.from('products').select('*').order('id', { ascending: false });
        setProducts(productData || []);
        const { data: memberData } = await supabase.from('users').select('*').order('points', { ascending: false });
        setMembers(memberData || []);
        if (currentAdmin?.role === 'super_admin') {
            const { data: adminData } = await supabase.from('admins').select('*').order('id', { ascending: true });
            setAdmins(adminData || []);
        }
        setTimeout(() => setIsRefreshing(false), 500); // หยุดหมุน
    };
    useEffect(() => { if (isAuthenticated) fetchData(); }, [isAuthenticated, currentAdmin]);

    // --- HELPER: COPY ---
    const handleCopy = (text: string, fieldId: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedField(fieldId);
        setTimeout(() => setCopiedField(null), 2000);
    };

    // --- LOGIN ---
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault(); setLoginError(""); setIsLoggingIn(true);
        try {
            const { data, error } = await supabase.from('admins').select('*').eq('username', usernameInput).eq('password', passwordInput).single();
            if (error || !data) setLoginError("❌ Incorrect Username or Password");
            else { setCurrentAdmin(data); setIsAuthenticated(true); }
        } catch (err) { setLoginError("Login failed."); } finally { setIsLoggingIn(false); }
    };

    // --- ACTIONS ---
    const handleSaveAdmin = async () => {
        if (!newAdminUser) return alert("Username required");
        if (!adminId && !newAdminPass) return alert("Password required");
        setIsProcessing(true);
        try {
            if (adminId) {
                const updateData: any = { role: newAdminRole, username: newAdminUser };
                if (newAdminPass) updateData.password = newAdminPass;
                await supabase.from('admins').update(updateData).eq('id', adminId);
            } else {
                await supabase.from('admins').insert([{ username: newAdminUser, password: newAdminPass, role: newAdminRole }]);
            }
            alert(adminId ? "✅ Updated" : "✅ Created"); resetAdminForm(); fetchData();
        } catch (e:any) { alert(e.message); } finally { setIsProcessing(false); }
    };
    const handleEditAdmin = (admin: any) => { setAdminId(admin.id); setNewAdminUser(admin.username); setNewAdminRole(admin.role); setNewAdminPass(""); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    const handleDeleteAdmin = async (id: number) => { if (id === currentAdmin.id || !confirm("Delete?")) return; await supabase.from('admins').delete().eq('id', id); fetchData(); };
    const resetAdminForm = () => { setAdminId(null); setNewAdminUser(""); setNewAdminPass(""); setNewAdminRole("admin"); };

    const handleSaveProduct = async () => {
        if (!prodName || !prodPrice) return alert("Fill all fields");
        setIsProcessing(true);
        try {
            let finalImageUrl = oldImageUrl;
            if (imageFile) {
                const fileName = `${Date.now()}.${imageFile.name.split('.').pop()}`;
                await supabase.storage.from('product-images').upload(fileName, imageFile);
                const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
                finalImageUrl = data.publicUrl;
            }
            if (prodId) await supabase.from('products').update({ name: prodName, price_thb: parseFloat(prodPrice), image_url: finalImageUrl }).eq('id', prodId);
            else await supabase.from('products').insert([{ name: prodName, price_thb: parseFloat(prodPrice), image_url: finalImageUrl }]);
            alert("✅ Saved"); resetProdForm(); fetchData();
        } catch (e:any) { alert(e.message); } finally { setIsProcessing(false); }
    };
    const handleEditProduct = (p: any) => { setActiveTab('PRODUCTS'); setProdId(p.id); setProdName(p.name); setProdPrice(p.price_thb.toString()); setOldImageUrl(p.image_url); setImagePreview(p.image_url); setImageFile(null); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    const handleDeleteProduct = async (id: number) => { if (confirm("Delete?")) { await supabase.from('products').delete().eq('id', id); fetchData(); } };
    const resetProdForm = () => { setProdId(null); setProdName(""); setProdPrice(""); setImageFile(null); setImagePreview(null); setOldImageUrl(null); };
    const handleEditPoints = async (member: any) => {
        const pts = prompt(`Points for ${member.name}:`, member.points);
        if (pts !== null && !isNaN(Number(pts))) {
            let tier = Number(pts) > 5000 ? 'Platinum' : Number(pts) > 1000 ? 'Gold' : 'Silver';
            await supabase.from('users').update({ points: Number(pts), tier }).eq('wallet_address', member.wallet_address); fetchData();
        }
    };
    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { setImageFile(file); setImagePreview(URL.createObjectURL(file)); } };

    // 🔒 Login UI
    if (!isAuthenticated) return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 text-slate-900">
            <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-slate-200">
                <div className="text-center mb-6"><div className="w-16 h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"><Lock size={32} /></div><h1 className="text-2xl font-bold text-slate-800">Admin Login</h1></div>
                <form onSubmit={handleLogin} className="space-y-4">
                    <div><label className="text-xs font-bold text-slate-500">Username</label><input type="text" value={usernameInput} onChange={e=>setUsernameInput(e.target.value)} className="w-full p-3 border rounded-xl bg-slate-50 font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900" /></div>
                    <div><label className="text-xs font-bold text-slate-500">Password</label><input type="password" value={passwordInput} onChange={e=>setPasswordInput(e.target.value)} className="w-full p-3 border rounded-xl bg-slate-50 font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900" /></div>
                    {loginError && <div className="text-red-500 text-sm font-bold text-center">{loginError}</div>}
                    <button type="submit" disabled={isLoggingIn} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50">{isLoggingIn ? <Loader2 className="animate-spin mx-auto"/> : "Access Dashboard"}</button>
                </form>
                <div className="mt-6 text-center"><Link href="/mall" className="text-sm text-slate-400 hover:text-slate-800 font-bold flex justify-center gap-1"><ArrowLeft size={14}/> Back to Shop</Link></div>
            </div>
        </div>
    );

    // ✅ VIEW: ORDER DETAIL PAGE
    if (selectedOrder) return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20 animate-in fade-in slide-in-from-right duration-300">
            <header className="bg-white border-b sticky top-0 z-20 px-6 py-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"><ArrowLeft size={24} /></button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">Order #{selectedOrder.id}<span className={`px-2 py-0.5 rounded-full text-xs font-bold ${selectedOrder.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{selectedOrder.status}</span></h1>
                        <p className="text-xs text-slate-400">Placed on {new Date(selectedOrder.created_at).toLocaleString()}</p>
                    </div>
                </div>
                <button onClick={() => window.print()} className="hidden md:flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 border px-3 py-1.5 rounded-lg"><Printer size={16}/> Print Invoice</button>
            </header>

            <main className="max-w-4xl mx-auto p-6 space-y-6">
                {/* 1. Customer & Shipping */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-2"><User size={20} className="text-blue-600"/> Customer Info</h3>
                        <div className="space-y-3 text-sm">
                            <div>
                                <label className="text-xs text-slate-400 font-bold uppercase">Wallet Address</label>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="font-mono bg-slate-100 p-2 rounded text-slate-600 break-all border">{selectedOrder.buyer_wallet}</div>
                                    <button onClick={() => handleCopy(selectedOrder.buyer_wallet, 'buyer')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 transition-colors" title="Copy Address">{copiedField === 'buyer' ? <CheckCircle size={16} className="text-green-600"/> : <Copy size={16}/>}</button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs text-slate-400 font-bold uppercase">Name</label><div className="font-bold">{selectedOrder.shipping_info?.name}</div></div>
                                <div><label className="text-xs text-slate-400 font-bold uppercase">Phone</label><div>{selectedOrder.shipping_info?.phone}</div></div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-2"><MapPin size={20} className="text-red-600"/> Shipping Address</h3>
                        <div className="text-sm text-slate-700 leading-relaxed">{selectedOrder.shipping_info?.address}</div>
                    </div>
                </div>

                {/* 2. Order Items */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-4 mb-4"><List size={20} className="text-orange-600"/> Order Items</h3>
                    <div className="space-y-4">
                        {selectedOrder.items?.map((item: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border group hover:border-orange-200 transition-colors">
                                <div className="flex items-center gap-4">
                                    <img src={item.image_url} className="w-16 h-16 rounded-lg object-cover bg-white border group-hover:scale-105 transition-transform"/>
                                    <div><div className="font-bold text-slate-800">{item.name}</div><div className="text-sm text-slate-500">Unit Price: ฿{item.price_thb.toLocaleString()}</div><div className="text-xs text-slate-400">Qty: {item.quantity}</div></div>
                                </div>
                                <div className="text-right"><div className="font-bold text-lg text-slate-900">฿{(item.price_thb * item.quantity).toLocaleString()}</div></div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 3. Payment Summary */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-4 mb-4"><CreditCard size={20} className="text-purple-600"/> Payment Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm"><span>Subtotal</span><span className="font-bold">฿{selectedOrder.total_thb.toLocaleString()}</span></div>
                            <div className="flex justify-between text-sm text-green-600"><span>Discount</span><span className="font-bold">-฿{selectedOrder.discount_thb.toLocaleString()}</span></div>
                            <div className="flex justify-between text-xl font-extrabold text-slate-900 border-t pt-2 mt-2"><span>Total Amount</span><span>฿{selectedOrder.final_price_thb.toLocaleString()}</span></div>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                            <div className="text-sm text-purple-900 font-bold mb-2">Blockchain Transaction</div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-slate-500">Paid with:</span>
                                    <span className="font-bold font-mono">{selectedOrder.crypto_amount} {selectedOrder.payment_token}</span>
                                </div>
                                <div className="flex justify-between text-sm items-center">
                                    <span className="text-slate-500 flex items-center gap-1">To Merchant <ArrowRight size={12}/></span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs bg-white px-2 py-1 rounded border text-slate-600" title={MERCHANT_WALLET}>
                                            {MERCHANT_WALLET.slice(0,6)}...{MERCHANT_WALLET.slice(-4)}
                                        </span>
                                        <button onClick={() => handleCopy(MERCHANT_WALLET, 'merchant')} className="text-slate-400 hover:text-slate-800 transition-colors" title="Copy Merchant Address">
                                            {copiedField === 'merchant' ? <CheckCircle size={14} className="text-green-600"/> : <Copy size={14}/>}
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="border-t border-purple-200/50 pt-2 mt-2">
                                    <div className="text-xs text-slate-500 mb-1">Tx Hash:</div>
                                    <div className="flex items-center gap-2">
                                        <div className="font-mono text-[10px] bg-white px-2 py-1 rounded border text-slate-500 break-all flex-1">
                                            {selectedOrder.tx_hash || "No Hash (Old Order)"}
                                        </div>
                                        <button onClick={() => handleCopy(selectedOrder.tx_hash, 'hash')} className="text-slate-400 hover:text-slate-800" disabled={!selectedOrder.tx_hash}>
                                            {copiedField === 'hash' ? <CheckCircle size={14} className="text-green-600"/> : <Copy size={14}/>}
                                        </button>
                                        {selectedOrder.tx_hash && (
                                            <a href={`${BLOCK_EXPLORER}${selectedOrder.tx_hash}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700" title="View on Explorer">
                                                <ExternalLink size={14}/>
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );

    // 🔓 DEFAULT VIEW: DASHBOARD
    return (
        <div className="min-h-screen bg-slate-100 font-sans text-slate-900 pb-20">
            <header className="bg-slate-900 text-white p-6 shadow-md sticky top-0 z-10">
                <div className="max-w-6xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-3"><LayoutDashboard className="text-orange-500" /><h1 className="text-xl font-bold">Admin Dashboard</h1></div>
                    <div className="flex items-center gap-4">
                        <div className="text-xs text-right hidden sm:block"><div className="text-slate-400">Logged in as</div><div className="text-white font-bold flex items-center gap-1">{currentAdmin?.username}{currentAdmin?.role === 'super_admin' && <ShieldAlert size={12} className="text-yellow-400"/>}</div></div>
                        <button onClick={() => setIsAuthenticated(false)} className="text-xs font-bold bg-red-900/50 hover:bg-red-800 px-3 py-2 rounded-lg transition-colors">Logout</button>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* SIDEBAR */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-2 rounded-2xl shadow-sm border flex flex-col gap-1">
                        <button onClick={()=>setActiveTab('PRODUCTS')} className={`p-3 rounded-xl text-left font-bold flex items-center gap-2 ${activeTab==='PRODUCTS'?'bg-blue-50 text-blue-600':'hover:bg-slate-50'}`}><Package size={20}/> Products</button>
                        <button onClick={()=>setActiveTab('ORDERS')} className={`p-3 rounded-xl text-left font-bold flex items-center gap-2 ${activeTab==='ORDERS'?'bg-blue-50 text-blue-600':'hover:bg-slate-50'}`}><List size={20}/> Orders</button>
                        <button onClick={()=>setActiveTab('MEMBERS')} className={`p-3 rounded-xl text-left font-bold flex items-center gap-2 ${activeTab==='MEMBERS'?'bg-blue-50 text-blue-600':'hover:bg-slate-50'}`}><Users size={20}/> Members</button>
                        {currentAdmin?.role === 'super_admin' && <button onClick={()=>setActiveTab('ADMINS')} className={`p-3 rounded-xl text-left font-bold flex items-center gap-2 ${activeTab==='ADMINS'?'bg-purple-50 text-purple-600':'hover:bg-slate-50'}`}><Shield size={20}/> Manage Admins</button>}
                    </div>

                    {/* PRODUCT FORM */}
                    {activeTab === 'PRODUCTS' && (
                        <div className="bg-white p-6 rounded-2xl shadow-sm border h-fit sticky top-28">
                            <div className="flex justify-between items-center mb-4 border-b pb-2"><h2 className="text-sm font-bold flex items-center gap-2">{prodId ? "Edit Product" : "Add Product"}</h2>{prodId && <button onClick={resetProdForm} className="text-red-500"><X size={14}/></button>}</div>
                            <div className="space-y-3">
                                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 relative bg-white">{imagePreview ? <img src={imagePreview} className="w-full h-full object-cover rounded-xl" /> : <UploadCloud className="text-slate-400"/>}<input type="file" accept="image/*" className="hidden" onChange={handleImageChange} /></label>
                                <input type="text" value={prodName} onChange={e=>setProdName(e.target.value)} className="w-full p-2 border rounded-lg text-sm font-bold" placeholder="Name" />
                                <input type="number" value={prodPrice} onChange={e=>setProdPrice(e.target.value)} className="w-full p-2 border rounded-lg text-sm font-bold" placeholder="Price (THB)" />
                                <button onClick={handleSaveProduct} disabled={isProcessing} className={`w-full text-white py-2 rounded-lg font-bold text-sm ${prodId ? 'bg-blue-600' : 'bg-green-600'}`}>{isProcessing ? <Loader2 className="animate-spin mx-auto"/> : (prodId ? "Update" : "Add")}</button>
                            </div>
                        </div>
                    )}

                    {/* ADMIN FORM */}
                    {activeTab === 'ADMINS' && (
                        <div className="bg-white p-6 rounded-2xl shadow-sm border h-fit sticky top-28 border-purple-100">
                            <div className="flex justify-between items-center mb-4 border-b pb-2"><h2 className="text-sm font-bold flex items-center gap-2 text-purple-700">{adminId ? "Edit Admin" : "New Admin"}</h2>{adminId && <button onClick={resetAdminForm} className="text-red-500"><X size={14}/></button>}</div>
                            <div className="space-y-3">
                                <div><label className="text-xs font-bold text-slate-400">Username</label><input type="text" value={newAdminUser} onChange={e=>setNewAdminUser(e.target.value)} className="w-full p-2 border rounded-lg text-sm font-bold bg-white" /></div>
                                <div><label className="text-xs font-bold text-slate-400">Password</label><input type="text" value={newAdminPass} onChange={e=>setNewAdminPass(e.target.value)} className="w-full p-2 border rounded-lg text-sm font-bold bg-white" placeholder={adminId ? "Change Password" : "Password"} /></div>
                                <div><label className="text-xs font-bold text-slate-400">Role</label><select value={newAdminRole} onChange={e=>setNewAdminRole(e.target.value)} className="w-full p-2 border rounded-lg text-sm font-bold bg-white"><option value="admin">Admin</option><option value="super_admin">Super Admin</option></select></div>
                                <button onClick={handleSaveAdmin} disabled={isProcessing} className={`w-full text-white py-2 rounded-lg font-bold text-sm ${adminId ? 'bg-purple-600' : 'bg-green-600'}`}>{isProcessing ? <Loader2 className="animate-spin mx-auto"/> : (adminId ? "Update" : "Create")}</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* CONTENT AREA */}
                <div className="lg:col-span-3 space-y-6">
                    {/* ✅ เพิ่มปุ่ม Refresh ไว้ที่ Header ของทุกตาราง */}
                    
                    {activeTab === 'PRODUCTS' && (
                        <div className="bg-white p-6 rounded-2xl shadow-sm border">
                            <div className="flex justify-between items-center mb-4 border-b pb-2">
                                <h2 className="text-lg font-bold flex items-center gap-2"><Package size={20}/> Product List</h2>
                                <button onClick={fetchData} disabled={isRefreshing} className="text-sm font-bold text-slate-500 hover:text-blue-600 flex items-center gap-1 transition-colors disabled:opacity-50">
                                    <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""}/> Refresh
                                </button>
                            </div>
                            <div className="overflow-x-auto"><table className="w-full text-sm text-left text-slate-700"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">Img</th><th className="p-3">Name</th><th className="p-3">Price</th><th className="p-3 text-right">Action</th></tr></thead><tbody className="divide-y">{products.map((p) => (<tr key={p.id} className="hover:bg-slate-50"><td className="p-3"><img src={p.image_url} className="w-8 h-8 rounded bg-slate-100 object-cover"/></td><td className="p-3 font-bold">{p.name}</td><td className="p-3">฿{p.price_thb.toLocaleString()}</td><td className="p-3 text-right"><button onClick={() => handleEditProduct(p)} className="text-blue-600 mx-2"><Edit size={16}/></button><button onClick={() => handleDeleteProduct(p.id)} className="text-red-600"><Trash2 size={16}/></button></td></tr>))}</tbody></table></div>
                        </div>
                    )}
                    
                    {activeTab === 'ORDERS' && (
                        <div className="bg-white p-6 rounded-2xl shadow-sm border">
                            <div className="flex justify-between items-center mb-4 border-b pb-2">
                                <h2 className="text-lg font-bold flex items-center gap-2"><List size={20}/> Order History</h2>
                                <button onClick={fetchData} disabled={isRefreshing} className="text-sm font-bold text-slate-500 hover:text-blue-600 flex items-center gap-1 transition-colors disabled:opacity-50">
                                    <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""}/> Refresh
                                </button>
                            </div>
                            <div className="overflow-x-auto"><table className="w-full text-sm text-left text-slate-700"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">ID</th><th className="p-3">Customer</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3 text-right">Action</th></tr></thead><tbody className="divide-y">{orders.map((order) => (<tr key={order.id} className="hover:bg-slate-50"><td className="p-3 font-mono text-xs text-slate-500">#{order.id}</td><td className="p-3"><div className="font-bold text-xs truncate w-32">{order.buyer_wallet}</div></td><td className="p-3 font-bold">฿{order.final_price_thb.toLocaleString()}</td><td className="p-3"><span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">{order.status}</span></td><td className="p-3 text-right"><button onClick={() => setSelectedOrder(order)} className="text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-100 flex items-center gap-1 ml-auto"><Eye size={14}/> View</button></td></tr>))}</tbody></table></div>
                        </div>
                    )}

                    {activeTab === 'MEMBERS' && (
                        <div className="bg-white p-6 rounded-2xl shadow-sm border">
                            <div className="flex justify-between items-center mb-4 border-b pb-2">
                                <h2 className="text-lg font-bold flex items-center gap-2"><Users size={20}/> Members</h2>
                                <button onClick={fetchData} disabled={isRefreshing} className="text-sm font-bold text-slate-500 hover:text-blue-600 flex items-center gap-1 transition-colors disabled:opacity-50">
                                    <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""}/> Refresh
                                </button>
                            </div>
                            <div className="overflow-x-auto"><table className="w-full text-sm text-left text-slate-700"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">Wallet</th><th className="p-3">Name</th><th className="p-3">Points & Tier</th><th className="p-3 text-right">Action</th></tr></thead><tbody className="divide-y">{members.map((member) => (<tr key={member.wallet_address} className="hover:bg-slate-50"><td className="p-3 font-mono text-xs font-bold text-slate-600">{member.wallet_address.slice(0,6)}...</td><td className="p-3 font-bold">{member.name}</td><td className="p-3"><span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs mr-2">{member.tier}</span>{member.points} pts</td><td className="p-3 text-right"><button onClick={() => handleEditPoints(member)} className="text-blue-600 font-bold text-xs border border-blue-200 px-2 py-1 rounded">Edit</button></td></tr>))}</tbody></table></div>
                        </div>
                    )}
                    
                    {activeTab === 'ADMINS' && (
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-purple-200">
                            <div className="flex justify-between items-center mb-4 border-b pb-2">
                                <h2 className="text-lg font-bold flex items-center gap-2 text-purple-800"><Shield size={20}/> Manage Admin Team</h2>
                                <button onClick={fetchData} disabled={isRefreshing} className="text-sm font-bold text-slate-500 hover:text-purple-600 flex items-center gap-1 transition-colors disabled:opacity-50">
                                    <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""}/> Refresh
                                </button>
                            </div>
                            <div className="overflow-x-auto"><table className="w-full text-sm text-left text-slate-700"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">ID</th><th className="p-3">Username</th><th className="p-3">Role</th><th className="p-3 text-right">Actions</th></tr></thead><tbody className="divide-y">{admins.map((admin) => (<tr key={admin.id} className={`hover:bg-slate-50 ${admin.id === currentAdmin.id ? 'bg-purple-50' : ''}`}><td className="p-3 text-xs text-slate-500">#{admin.id}</td><td className="p-3 font-bold flex items-center gap-2">{admin.username}{admin.id === currentAdmin.id && <span className="bg-purple-200 text-purple-800 text-[10px] px-1.5 rounded">YOU</span>}</td><td className="p-3"><span className={`px-2 py-1 rounded-full text-xs font-bold ${admin.role === 'super_admin' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{admin.role === 'super_admin' ? 'Super Admin' : 'Admin'}</span></td><td className="p-3 text-right"><button onClick={() => handleEditAdmin(admin)} className="text-blue-600 mx-2 hover:bg-blue-100 p-1 rounded"><Edit size={16}/></button><button onClick={() => handleDeleteAdmin(admin.id)} className="text-red-600 hover:bg-red-100 p-1 rounded disabled:opacity-30" disabled={admin.id === currentAdmin.id}><Trash2 size={16}/></button></td></tr>))}</tbody></table></div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}