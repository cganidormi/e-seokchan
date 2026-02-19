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
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">4. 이용자 및 법정대리인의 권리와 그 행사방법</h2>
                        <ul className="list-disc list-inside text-gray-600 space-y-2">
                            <li>정보주체는 언제든지 자신의 개인정보를 열람하거나 정정을 요구할 수 있습니다.</li>
                            <li>개인정보의 오류에 대한 정정 및 삭제를 요청한 경우에는 정정 또는 삭제를 완료할 때까지 당해 개인정보를 이용하거나 제공하지 않습니다.</li>
                            <li>만 14세 미만 아동의 경우, 법정대리인이 아동의 개인정보 조회 및 수정, 수집 동의 철회 권리를 가집니다. 가입 시 법정대리인의 동의가 필요합니다.</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">5. 개인정보의 안전성 확보 조치</h2>
                        <ul className="list-disc list-inside text-gray-600 space-y-2">
                            <li>모든 데이터 통신은 HTTPS 암호화 적용</li>
                            <li>DB 내 데이터 암호화 저장 및 접근 제어 정책(RLS) 적용</li>
                            <li>비밀번호 해시 처리를 통한 복구 불가능한 암호화</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">6. 개인정보 보호책임자</h2>
                        <p className="text-gray-600 leading-relaxed mb-2">
                            [이석찬]은 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
                        </p>
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <ul className="list-disc list-inside text-gray-600 space-y-1">
                                <li>책임자: (학교 담당자 성명 기재)</li>
                                <li>연락처: (학교 대표 번호 또는 담당 부서 연락처 기재)</li>
                                <li>이메일: (담당자 이메일 기재)</li>
                            </ul>
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
