'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

export default function PrivacyPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto bg-white shadow sm:rounded-lg overflow-hidden">
                <div className="px-4 py-5 sm:p-6">
                    <button
                        onClick={() => router.back()}
                        className="mb-6 text-gray-500 hover:text-gray-700 flex items-center"
                    >
                        <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        뒤로가기
                    </button>
                    <h1 className="text-3xl font-bold text-gray-900 mb-8 pb-4 border-b">개인정보 처리방침</h1>

                    <p className="text-gray-600 mb-8 leading-relaxed">
                        본 서비스 '이석찬'(이하 '서비스')은 정보주체의 자유와 권리 보호를 위해 「개인정보 보호법」 및 관계 법령이 정한 바를 준수하여, 적법하게 개인정보를 처리하고 안전하게 관리하고 있습니다.
                    </p>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">1. 개인정보의 수집 및 이용 목적</h2>
                        <p className="text-gray-600 leading-relaxed mb-4">
                            서비스는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.
                        </p>
                        <ul className="list-disc list-inside text-gray-600 space-y-2">
                            <li>학생: 기숙사 외박/외출/잔류 신청 및 승인 관리, 점호 확인</li>
                            <li>교사: 학생 신청 내역 승인/반려 처리, 기숙사생 생활 지도 및 관리</li>
                            <li>학부모: 자녀의 외박/외출 신청 내역 조회 및 승인 알림 수신</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">2. 수집하는 개인정보의 항목</h2>
                        <p className="text-gray-600 leading-relaxed mb-4">
                            서비스는 회원가입 절차 없이 학교에서 부여된 계정 정보를 기반으로 운영되며, 최소한의 개인정보만을 수집·처리합니다.
                        </p>
                        <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                            <p className="text-gray-700"><span className="font-bold">[학생] 필수항목:</span> 성명, 학번(학년/반/번호), 기숙사 호실 정보</p>
                            <p className="text-gray-700"><span className="font-bold">[교사] 필수항목:</span> 성명, 직위/직책 (담임 여부 등)</p>
                            <p className="text-gray-700"><span className="font-bold">[학부모] 필수항목:</span> 수집하지 않음 (학생 정보를 통한 자녀 확인)</p>
                            <p className="text-gray-500 text-sm mt-2">* 본 서비스는 주민등록번호나 전화번호를 수집하지 않습니다.</p>
                        </div>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">3. 개인정보의 보유 및 이용 기간</h2>
                        <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-gray-600">
                            <p>개인정보는 원칙적으로 서비스 이용 목적이 달성되면 지체 없이 파기합니다. 단, 다음의 정보에 대해서는 아래의 이유로 명시한 기간 동안 보존합니다.</p>
                            <ul className="list-disc list-inside mt-2">
                                <li><strong>보존 항목:</strong> 외박/외출 신청 이력, 점호 기록</li>
                                <li><strong>보존 근거:</strong> 기숙사 운영 규정에 따른 생활 기록 보존</li>
                                <li><strong>보존 기간:</strong> 졸업 시 또는 학교의 별도 규정에 따름 (최대 3년)</li>
                            </ul>
                        </div>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">4. 개인정보의 제3자 제공</h2>
                        <p className="text-gray-600 leading-relaxed">
                            서비스는 정보주체의 개인정보를 명시한 범위 내에서만 처리하며, 정보주체의 동의, 법률의 특별한 규정 등 「개인정보 보호법」 제17조 및 제18조에 해당하는 경우를 제외하고는 본인의 동의 없이 개인정보를 제3자에게 제공하지 않습니다.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">5. 정보주체의 권리·의무 및 행사 방법</h2>
                        <p className="text-gray-600 leading-relaxed mb-4">
                            정보주체는 언제든지 다음 각 호의 개인정보 보호 관련 권리를 행사할 수 있습니다.
                        </p>
                        <ul className="list-disc list-inside text-gray-600 space-y-2 mb-4">
                            <li>개인정보 열람 요구</li>
                            <li>오류 등이 있을 경우 정정 요구</li>
                            <li>삭제 요구</li>
                            <li>처리정지 요구</li>
                        </ul>
                        <p className="text-gray-600 leading-relaxed">
                            <strong>* 권리 행사 방법:</strong> 정보주체(학생 및 학부모)는 교내 시스템 관리자(담당 교사)에게 구두, 서면 또는 교내 메신저 등을 통해 권리 행사를 요구할 수 있으며, 서비스 관리자는 이에 대해 지체 없이 조치하겠습니다.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">6. 개인정보의 안전성 확보 조치</h2>
                        <p className="text-gray-600 leading-relaxed mb-4">
                            서비스는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.
                        </p>
                        <ul className="list-disc list-inside text-gray-600 space-y-2">
                            <li><strong>관리적 조치:</strong> 내부 관리계획 수립 및 시행, 개인정보 취급 담당자 최소화</li>
                            <li><strong>기술적 조치:</strong> 개인정보 데이터의 암호화 저장, 관리자 페이지 접근 통제 및 인증 절차 적용</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">7. 개인정보 보호책임자 및 처리 업무 위탁</h2>
                        <div className="text-gray-600 leading-relaxed space-y-4">
                            <div>
                                <p className="mb-2">1) 서비스는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 관련 민원 처리를 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.</p>
                                <ul className="list-disc list-inside ml-4 space-y-1">
                                    <li><strong>개인정보 보호책임자:</strong> [OO학교장]</li>
                                    <li><strong>개인정보 보호 실무 담당자:</strong> [교사 OOO] (연락처: 학교 대표번호)</li>
                                </ul>
                            </div>
                            <div>
                                <p>2) 본 서비스는 외부 업체에 개인정보 처리 업무를 위탁하지 않으며, 교내 자체 시스템으로 안전하게 운영·관리됩니다.</p>
                            </div>
                        </div>
                    </section>


                    <div className="mt-12 pt-8 border-t text-sm text-gray-500">
                        <p>공고일자: 2026년 2월 19일</p>
                        <p>시행일자: 2026년 2월 19일</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
