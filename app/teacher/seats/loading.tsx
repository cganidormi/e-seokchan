export default function SeatsLoading() {
  return (
    <div className="p-4 md:p-6 bg-gray-100 min-h-screen animate-pulse">
      {/* 상단 헤더 및 버튼 뼈대 */}
      <div className="flex justify-between items-center mb-6">
        <div className="h-8 w-48 bg-gray-300 rounded-lg"></div>
        <div className="flex gap-2">
          <div className="h-10 w-10 bg-gray-300 rounded-xl"></div>
          <div className="h-10 w-24 bg-gray-300 rounded-xl"></div>
        </div>
      </div>

      {/* 정보 영역 뼈대 */}
      <div className="bg-white p-4 rounded-2xl shadow-sm mb-6 flex flex-col gap-3">
        <div className="h-5 w-32 bg-gray-200 rounded"></div>
        <div className="h-4 w-64 bg-gray-200 rounded"></div>
      </div>

      {/* 자리 배치 그리드 뼈대 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="bg-white h-24 rounded-2xl shadow-sm p-4 flex flex-col justify-center items-center gap-2 border border-gray-100">
             <div className="h-4 w-16 bg-gray-200 rounded"></div>
             <div className="h-5 w-20 bg-gray-300 rounded"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
