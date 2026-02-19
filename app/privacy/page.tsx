'use client';

import { useRouter } from 'next/navigation';

export default function PrivacyPolicy() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-white p-6 md:p-12">
            <div className="max-w-2xl mx-auto">
                <button
                    onClick={() => router.back()}
                    className="mb-8 text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1"
                >
                    ← 돌아가기
                </button>

                <h1 className="text-3xl font-bold mb-8">개인정보 처리방침</h1>

                <div className="prose prose-sm text-gray-700 space-y-6">
                    <p className="border-b pb-4 text-gray-500">
                        본 서비스 <strong>'이석찬'</strong>(이하 '서비스')은 정보주체의 자유와 권리 보호를 위해 「개인정보 보호법」 및 관계 법령이 정한 바를 준수하여, 적법하게 개인정보를 처리하고 안전하게 관리하고 있습니다.
                    </p>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-3">1. 개인정보의 수집 및 이용 목적</h2>
                        <p>서비스는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.</p>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li><strong>학생:</strong> 기숙사 외박/외출/잔류 신청 및 승인 관리, 점호 확인</li>
                            <li><strong>교사:</strong> 학생 신청 내역 승인/반려 처리, 기숙사생 생활 지도 및 관리</li>
                            <li><strong>학부모:</strong> 자녀의 외박/외출 신청 내역 조회 및 승인 알림 수신</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-3">2. 수집하는 개인정보의 항목</h2>
                        <p>서비스는 회원가입 절차 없이 학교에서 부여된 계정 정보를 기반으로 운영되며, 최소한의 개인정보만을 수집·처리합니다.</p>
                        <div className="bg-gray-50 p-4 rounded-lg mt-2 text-sm">
                            <ul className="list-disc pl-5 space-y-1">
                                <li><strong>[학생] 필수항목:</strong> 성명, 학번(학년/반/번호), 기숙사 호실 정보</li>
                                <li><strong>[교사] 필수항목:</strong> 성명, 직위/직책 (담임 여부 등)</li>
                                <li><strong>[학부모] 필수항목:</strong> 수집하지 않음 (학생 정보를 통한 자녀 확인)</li>
                            </ul>
                            <p className="mt-2 text-xs text-gray-500">* 본 서비스는 주민등록번호나 전화번호를 수집하지 않습니다.</p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-3">3. 개인정보의 보유 및 이용 기간</h2>
                        <p>개인정보는 원칙적으로 서비스 이용 목적이 달성되면 지체 없이 파기합니다. 단, 다음의 정보에 대해서는 아래의 이유로 명시한 기간 동안 보존합니다.</p>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li><strong>보존 항목:</strong> 외박/외출 신청 이력, 점호 기록</li>
                            <li><strong>보존 근거:</strong> 기숙사 운영 규정에 따른 생활 기록 보존</li>
                            <li><strong>보존 기간:</strong> 졸업 시 또는 학교의 별도 규정에 따름 (최대 3년)</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-3">4. 개인정보의 제3자 제공</h2>
                        <p>서비스는 정보주체의 개인정보를 명시한 범위 내에서만 처리하며, 정보주체의 동의, 법률의 특별한 규정 등 「개인정보 보호법」 제17조 및 제18조에 해당하는 경우를 제외하고는 본인의 동의 없이 개인정보를 제3자에게 제공하지 않습니다.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900 mb-3">5. 정보주체의 권리·의무 및 행사 방법</h2>
                        <p>정보주체는 언제든지 다음 각 호의 개인정보 보호 관련 권리를 행사할 수 있습니다.</p>
                        <ol className="list-decimal pl-5 mt-2 space-y-1">
                            <li>개인정보 열람 요구</li>
                            <li>오류 등이 있을 경우 정정 요구</li>
                            <li>삭제 요구</li>
                            <li>처리정지 요구</li>
                        </ol>
                    </section>

                    <div className="pt-8 mt-8 border-t text-xs text-gray-400">
                        <p>본 방침은 2026년 2월 19일부터 시행됩니다.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
