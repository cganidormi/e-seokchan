'use client';

import React from 'react';

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto bg-white shadow sm:rounded-lg overflow-hidden">
                <div className="px-4 py-5 sm:p-6">
                    <h1 className="text-3xl font-bold text-gray-900 mb-8 pb-4 border-b">개인정보 처리방침</h1>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">1. 개인정보의 수집 및 이용 목적</h2>
                        <p className="text-gray-600 leading-relaxed mb-4">
                            [이석찬]은 기숙사 생활 관리 및 학생 안전 확보를 위해 다음과 같은 목적으로 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.
                        </p>
                        <ul className="list-disc list-inside text-gray-600 space-y-2">
                            <li>학생 이석(외출, 외박, 이동 등) 신청 및 승인 관리</li>
                            <li>기숙사 내 좌석 배치 및 인원 점검</li>
                            <li>상벌점 부여 및 이력 관리</li>
                            <li>보호자 대상 자녀 위치 및 안전 상태 정보 제공</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">2. 수집하는 개인정보 항목</h2>
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <p className="text-gray-700 font-medium mb-2">[수집 항목]</p>
                            <ul className="list-disc list-inside text-gray-600 space-y-1">
                                <li>학생: 이름, 학년/반/번호, 성별, 학번, 상벌점 정보, 이석 사유, 비밀번호</li>
                                <li>교사: 이름, 직함, 연락처(선택), 비밀번호</li>
                                <li>학부모: 자녀 이름, 고유 토큰 정보</li>
                            </ul>
                        </div>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">3. 개인정보의 보유 및 이용 기간</h2>
                        <p className="text-gray-600 leading-relaxed">
                            본 시스템은 서비스 제공 기간 동안 혹은 학생의 재학 기간 동안 개인정보를 보유하며, 졸업 또는 서비스 종료 시 원칙적으로 지체 없이 파기합니다. 단, 관계 법령에 의해 보존할 필요가 있는 경우 해당 법령에 따릅니다.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">4. 개인정보의 파기절차 및 파기방법</h2>
                        <p className="text-gray-600 leading-relaxed">
                            본 서비스는 원칙적으로 개인정보 수집 및 이용목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 파기절차 및 방법은 다음과 같습니다.
                        </p>
                        <ul className="list-disc list-inside text-gray-600 space-y-2 mt-2">
                            <li>파기절차: 이용자가 입력한 정보는 목적 달성 후 내부 방침 및 기타 관련 법령에 의한 정보보호 사유에 따라 일정 기간 저장된 후 파기됩니다.</li>
                            <li>파기방법: 전자적 파일조차 형태로 저장된 개인정보는 기록을 재생할 수 없는 기술적 방법을 사용하여 삭제합니다.</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">5. 이용자 및 법정대리인의 권리와 그 행사방법</h2>
                        <ul className="list-disc list-inside text-gray-600 space-y-2 mb-4">
                            <li>정보주체는 언제든지 자신의 개인정보를 열람하거나 정정을 요구할 수 있습니다.</li>
                            <li>개인정보의 오류에 대한 정정 및 삭제를 요청한 경우에는 정정 또는 삭제를 완료할 때까지 당해 개인정보를 이용하거나 제공하지 않습니다.</li>
                        </ul>
                        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                            <p className="text-gray-700 font-medium">* 권리 행사 방법</p>
                            <p className="text-gray-600 mt-1">
                                정보주체(학생 및 학부모)는 교내 시스템 관리자(담당 교사)에게 구두, 서면 또는 교내 메신저 등을 통해 권리 행사를 요구할 수 있으며, 서비스 관리자는 이에 대해 지체 없이 조치하겠습니다.
                            </p>
                        </div>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">6. 개인정보의 안전성 확보 조치</h2>
                        <p className="text-gray-600 leading-relaxed mb-2">서비스는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.</p>
                        <ul className="list-disc list-inside text-gray-600 space-y-2">
                            <li><strong>관리적 조치</strong>: 내부 관리계획 수립 및 시행, 개인정보 취급 담당자 최소화</li>
                            <li><strong>기술적 조치</strong>: 개인정보 데이터의 암호화 저장, 관리자 페이지 접근 통제 및 인증 절차 적용</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">7. 개인정보 보호책임자 및 처리 업무 위탁</h2>
                        <div className="space-y-4">
                            <div>
                                <p className="text-gray-600 leading-relaxed mb-2">1) 서비스는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 관련 민원 처리를 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.</p>
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                                        <li><strong>개인정보 보호책임자</strong>: [강원과학고등학교장]</li>
                                        <li><strong>개인정보 보호 실무 담당자</strong>: [기숙사사감팀장] (연락처: 033-740-9700)</li>
                                    </ul>
                                </div>
                            </div>
                            <div>
                                <p className="text-gray-600 leading-relaxed">2) 본 서비스는 외부 업체에 개인정보 처리 업무를 위탁하지 않으며, 교내 자체 시스템으로 안전하게 운영·관리됩니다.</p>
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
