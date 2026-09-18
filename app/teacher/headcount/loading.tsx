export default function HeadcountLoading() {
  return (
    <div className="p-4 md:p-6 bg-gray-100 min-h-screen animate-pulse">
      {/* 상단 헤더 뼈대 */}
      <div className="flex justify-between items-center mb-6">
        <div className="h-8 w-48 bg-gray-300 rounded-lg"></div>
        <div className="flex gap-2">
          <div className="h-10 w-10 bg-gray-300 rounded-xl"></div>
          <div className="h-10 w-28 bg-gray-300 rounded-xl"></div>
        </div>
      </div>

      {/* 통계 요약 영역 뼈대 */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white h-16 rounded-xl shadow-sm"></div>
        ))}
      </div>

      {/* 호실 리스트 뼈대 */}
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <div className="h-6 w-20 bg-gray-300 rounded"></div>
              <div className="h-6 w-16 bg-gray-200 rounded-full"></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="h-10 bg-gray-100 rounded-lg"></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
