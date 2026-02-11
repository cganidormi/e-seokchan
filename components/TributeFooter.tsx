
import React from 'react';

export default function TributeFooter() {
    return (
        <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            width: '100%',
            backgroundColor: '#000',
            color: '#fff',
            padding: '12px 20px',
            textAlign: 'center',
            fontSize: '11px',
            zIndex: 9999,
            lineHeight: '1.6',
            borderTop: '1px solid #333',
            wordBreak: 'keep-all'
        }}>
            <div style={{ marginBottom: '4px', opacity: 0.9 }}>
                본 프로그램은 2018년부터 모교와 후배들을 위하여 헌신한 26기 남정연 학생의 정신을 계승하여 새롭게 만들어졌습니다.
            </div>
            <div style={{ opacity: 0.6, fontSize: '10px' }}>
                Copyright 2026 © 이상찬. All Rights Reserved. Designed & Developed by 이상찬. Legacy inherited from 남정연
            </div>
        </div>
    );
}
