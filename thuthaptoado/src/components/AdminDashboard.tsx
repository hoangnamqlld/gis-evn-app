
import React, { useMemo, useState, useEffect } from 'react';
import { GridAsset, AssetType, PowerLine } from '../types';
import { CloudService } from '../services/cloudService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface AdminDashboardProps {
  assets: GridAsset[];
  lines: PowerLine[];
  projectId: string;
  onClose: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ assets, lines, projectId, onClose }) => {
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => setIsLargeScreen(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const stats = useMemo(() => {
    return {
      total: assets.length,
      substations: assets.filter(a => a.type === AssetType.SUBSTATION).length,
      poles_mv: assets.filter(a => a.type === AssetType.POLE_MV).length,
      poles_lv: assets.filter(a => a.type === AssetType.POLE_LV).length,
      switchgear: assets.filter(a => a.type === AssetType.SWITCHGEAR).length,
      meters: assets.filter(a => a.type === AssetType.METER).length,
    };
  }, [assets]);

  const chartData = [
    { name: 'Trạm BA', value: stats.substations, color: '#1d4ed8' },
    { name: 'Trụ Trung Thế', value: stats.poles_mv, color: '#7c3aed' },
    { name: 'Trụ Hạ Thế', value: stats.poles_lv, color: '#059669' },
    { name: 'Điện kế', value: stats.meters, color: '#db2777' },
  ];

  if (!isLargeScreen) {
    return (
      <div className="fixed inset-0 bg-slate-900 z-[5000] flex items-center justify-center p-8 animate-fade-in">
        <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 text-center space-y-6 shadow-2xl">
          <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full mx-auto flex items-center justify-center text-3xl">
            <i className="fas fa-desktop"></i>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter leading-tight">Yêu cầu máy tính</h3>
            <p className="text-xs font-medium text-slate-500 leading-relaxed">Admin Dashboard chứa nhiều biểu đồ và bảng dữ liệu VN2000 phức tạp. Vui lòng đăng nhập trên máy tính để sử dụng tính năng này.</p>
          </div>
          <button onClick={onClose} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg">Quay lại bản đồ</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-100 z-[5000] flex flex-col overflow-hidden animate-fade-in">
      <div className="flex h-full">
        <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0">
          <div className="p-6 border-b border-slate-800">
            <h1 className="text-xl font-black tracking-tighter uppercase">EVNHCMC <span className="text-blue-500">Center</span></h1>
          </div>
          <nav className="flex-1 p-4 space-y-2">
            <div className="p-3 rounded-xl bg-blue-600 text-white text-xs font-black uppercase tracking-widest shadow-lg cursor-default">
              <i className="fas fa-chart-line mr-3"></i> Bảng điều khiển
            </div>
            <button onClick={() => CloudService.openDriveFolder()} className="w-full text-left p-3 rounded-xl hover:bg-slate-800 text-amber-400 text-xs font-black uppercase tracking-widest transition-all">
              <i className="fab fa-google-drive mr-3"></i> Hình ảnh hiện trường
            </button>
          </nav>
          <div className="p-6">
            <button onClick={onClose} className="w-full bg-slate-800 p-3 rounded-xl text-[10px] font-black uppercase hover:bg-red-900 transition-all">
              Đóng Dashboard
            </button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          <header className="bg-white h-16 border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Dự án: {projectId}</h2>
            <div className="flex gap-4">
               <button onClick={() => CloudService.exportDataToJSON(assets, lines, projectId)} className="px-4 py-2 border-2 border-slate-100 text-slate-700 rounded-xl text-[10px] font-black uppercase hover:bg-slate-50">Xuất báo cáo JSON</button>
               <button onClick={() => CloudService.openDriveFolder()} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg">
                 <i className="fab fa-google-drive"></i> Quản lý Drive
               </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
            <div className="grid grid-cols-4 gap-6">
               {[
                 { label: 'Tổng số điểm', value: stats.total, icon: 'fa-database', color: 'text-slate-800' },
                 { label: 'Trạm Biến Áp', value: stats.substations, icon: 'fa-bolt', color: 'text-blue-600' },
                 { label: 'Trụ Trung Thế', value: stats.poles_mv, icon: 'fa-tower-broadcast', color: 'text-violet-600' },
                 { label: 'Điện kế', value: stats.meters, icon: 'fa-gauge-high', color: 'text-pink-600' }
               ].map((item, i) => (
                 <div key={i} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-lg shadow-inner">
                      <i className={`fas ${item.icon} ${item.color}`}></i>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</p>
                      <p className="text-xl font-black">{item.value}</p>
                    </div>
                 </div>
               ))}
            </div>

            <div className="grid grid-cols-3 gap-8">
              <div className="col-span-1 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6">Thống kê cơ cấu thiết bị</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" fontSize={9} fontWeight="bold" />
                      <YAxis fontSize={10} fontWeight="bold" />
                      <Tooltip />
                      <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="col-span-2 bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Danh sách chi tiết VN2000</h3>
                </div>
                <div className="flex-1 overflow-y-auto max-h-[400px]">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Thiết bị</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Tọa độ VN2000 (X, Y)</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Nhân viên</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {assets.map((a) => (
                        <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="text-xs font-black text-slate-800">{a.name}</p>
                            <p className="text-[9px] font-bold text-blue-600 font-mono">{a.code}</p>
                          </td>
                          <td className="px-6 py-4 font-mono text-[10px] font-bold text-slate-600">
                            {a.coords.x_vn2000?.toFixed(3)}, {a.coords.y_vn2000?.toFixed(3)}
                          </td>
                          <td className="px-6 py-4">
                             <p className="text-[10px] font-black text-slate-700">{a.collectorName}</p>
                             <p className="text-[8px] font-bold text-slate-400 uppercase">{a.unit}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase ${a.status === 'Synced' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                              {a.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
