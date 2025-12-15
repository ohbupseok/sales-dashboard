import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

declare const html2canvas: any;

const REPORTING_TIMES = [11, 14, 16, 18];
const TOTAL_WORK_DURATION = 9; // 9시 to 18시
const HOURS_PASSED_MAP: { [key: number]: number } = { 11: 2, 14: 5, 16: 7, 18: 9 };
const today = new Date().toISOString().split('T')[0];
const DEFAULT_WEIGHTS: { [key: number]: number } = { 11: 35, 14: 70, 16: 90, 18: 100 };
const DEFAULT_MONTHLY_GOALS = {
  attemptRate: 90,
  activeAttemptRate: 50,
  sttMentionRate: 70,
  activationGoal: 120,
};
const DEFAULT_PRODUCT_GOALS: ProductGoal[] = [
    { id: Date.now(), name: '주력상품A', goal: 500 },
    { id: Date.now() + 1, name: '프로모션B', goal: 200 },
];


// 대한민국 2025년 공휴일 (대체공휴일 포함)
const HOLIDAYS_2025 = new Set([
    '2025-01-01', // 신정
    '2025-01-28', // 설날
    '2025-01-29', // 설날
    '2025-01-30', // 설날
    '2025-03-01', // 3.1절
    '2025-05-05', // 어린이날, 부처님오신날
    '2025-05-06', // 대체공휴일
    '2025-06-06', // 현충일
    '2025-08-15', // 광복절
    '2025-10-03', // 개천절
    '2025-10-05', // 추석 (일요일)
    '2025-10-06', // 추석
    '2025-10-07', // 추석
    '2025-10-08', // 대체공휴일 (추석)
    '2025-10-09', // 한글날
    '2025-12-25', // 크리스마스
]);

interface ReportEntry {
    reportingTime: number;
    calls: number;
    memoAttempts: number;
    managerAttempts: number;
    sttAttempts: number;
    productSuccesses: { [productName: string]: number };
    activations: number;
}
interface MonthInfoOverrides {
    openingDays?: number;
    netApplicationDays?: number;
}
interface ProductGoal {
    id: number;
    name: string;
    goal: number;
}
interface Toast {
    id: number;
    message: string;
    type: 'success' | 'info' | 'warning';
}

type TeamType = 'team1' | 'team2';

const getMonthInfo = (dateString: string) => {
    const date = new Date(dateString.replace(/-/g, '/'));
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed
    
    // 현재는 2025년 공휴일만 지원합니다. 다른 연도는 주말만 계산됩니다.
    const holidays = year === 2025 ? HOLIDAYS_2025 : new Set();

    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let openingDays = 0;
    let netApplicationDays = 0;

    for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, month, day);
        const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
        const currentDateString = currentDate.toISOString().split('T')[0];
        const isHoliday = holidays.has(currentDateString);

        // 개통 가능일: 일요일과 공휴일 제외
        if (dayOfWeek !== 0 && !isHoliday) {
            openingDays++;
        }

        // 순청약 영업일: 토요일, 일요일, 공휴일 제외
        if (dayOfWeek > 0 && dayOfWeek < 6 && !isHoliday) {
            netApplicationDays++;
        }
    }
    return { openingDays, netApplicationDays };
};

const getPassedWorkdays = (dateString: string) => {
    const date = new Date(dateString.replace(/-/g, '/'));
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed
    const dayOfMonth = date.getDate();

    const holidays = year === 2025 ? HOLIDAYS_2025 : new Set();
    let passedWorkdays = 0;

    for (let day = 1; day <= dayOfMonth; day++) {
        const currentDate = new Date(year, month, day);
        const dayOfWeek = currentDate.getDay();
        const currentDateString = currentDate.toISOString().split('T')[0];
        const isHoliday = holidays.has(currentDateString);

        if (dayOfWeek > 0 && dayOfWeek < 6 && !isHoliday) {
            passedWorkdays++;
        }
    }
    return passedWorkdays;
};

const getPassedOpeningDays = (dateString: string) => {
    const date = new Date(dateString.replace(/-/g, '/'));
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed
    const dayOfMonth = date.getDate();

    const holidays = year === 2025 ? HOLIDAYS_2025 : new Set();
    let passedOpeningDays = 0;

    for (let day = 1; day <= dayOfMonth; day++) {
        const currentDate = new Date(year, month, day);
        const dayOfWeek = currentDate.getDay(); // 0 = Sunday
        const currentDateString = currentDate.toISOString().split('T')[0];
        const isHoliday = holidays.has(currentDateString);

        if (dayOfWeek !== 0 && !isHoliday) {
            passedOpeningDays++;
        }
    }
    return passedOpeningDays;
};

const getPreviousDay = (dateString: string) => {
    const date = new Date(dateString.replace(/-/g, '/'));
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
};

const CircularProgress: React.FC<{ value: number; max: number; size?: number; strokeWidth?: number; label?: string; subLabel?: string; color?: string }> = ({ value, max, size = 100, strokeWidth = 8, label, subLabel, color = 'var(--primary-color)' }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    const offset = circumference - (percentage / 100) * circumference;
    const isComplete = percentage >= 100;

    return (
        <div className={`circular-progress-container ${isComplete ? 'celebration' : ''}`} style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle
                    className="circular-bg"
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    strokeWidth={strokeWidth}
                />
                <circle
                    className="circular-fg"
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    style={{ stroke: isComplete ? 'var(--success-color)' : color }}
                />
            </svg>
            <div className="circular-text">
                <div className="circular-value" style={{ color: isComplete ? 'var(--success-color)' : color }}>{percentage.toFixed(0)}%</div>
                {label && <div className="circular-label">{label}</div>}
            </div>
        </div>
    );
};


const PerformanceChart: React.FC<{ entries: ReportEntry[] }> = ({ entries }) => {
    const chartHeight = 200;
    const chartWidth = 500;
    const padding = { top: 20, right: 20, bottom: 30, left: 40 };
    const drawableWidth = chartWidth - padding.left - padding.right;
    const drawableHeight = chartHeight - padding.top - padding.bottom;
    
    const totalSuccesses = entries.reduce((sum, entry) => sum + Object.values(entry.productSuccesses).reduce<number>((s, c) => s + Number(c), 0), 0);
    const maxVal = Math.max(...entries.map(e => e.calls), totalSuccesses, 1);
    const yScale = drawableHeight / maxVal;
    const barWidth = drawableWidth / (REPORTING_TIMES.length * 2.5);

    const yAxisLabels = [0, Math.round(maxVal / 2), maxVal];

    return (
        <div className="chart-container">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="xMidYMid meet" aria-labelledby="chart-title" role="img">
                <title id="chart-title">시간대별 인입 콜 및 성공 건수</title>
                {/* Y Axis */}
                <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + drawableHeight} stroke="var(--border-color)" />
                {yAxisLabels.map((label, i) => (
                    <g key={i}>
                        <text x={padding.left - 8} y={padding.top + drawableHeight - (label * yScale)} textAnchor="end" alignmentBaseline="middle" fontSize="10" fill="var(--secondary-text-color)">{label}</text>
                        {label > 0 && <line x1={padding.left} x2={chartWidth - padding.right} y1={padding.top + drawableHeight - (label * yScale)} y2={padding.top + drawableHeight - (label * yScale)} stroke="var(--border-color)" strokeDasharray="2,2" />}
                    </g>
                ))}

                {/* X Axis & Bars */}
                <line x1={padding.left} y1={padding.top + drawableHeight} x2={chartWidth - padding.right} y2={padding.top + drawableHeight} stroke="var(--border-color)" />
                {REPORTING_TIMES.map((time, index) => {
                    const entry = entries.find(e => e.reportingTime === time);
                    const groupX = padding.left + (drawableWidth / REPORTING_TIMES.length) * (index + 0.5);
                    const callBarHeight = entry ? entry.calls * yScale : 0;
                    const entryTotalSuccess = entry ? Object.values(entry.productSuccesses).reduce<number>((s,c) => s + Number(c), 0) : 0;
                    const successBarHeight = entry ? entryTotalSuccess * yScale : 0;

                    return (
                        <g key={time}>
                            {entry && (
                                <>
                                    <rect x={groupX - barWidth} y={padding.top + drawableHeight - callBarHeight} width={barWidth} height={callBarHeight} fill="#a9cce3" aria-label={`${time}시 인입 콜 ${entry.calls}건`}><title>{`${time}시 인입 콜: ${entry.calls}건`}</title></rect>
                                    <rect x={groupX} y={padding.top + drawableHeight - successBarHeight} width={barWidth} height={successBarHeight} fill="var(--success-color)" aria-label={`${time}시 성공 ${entryTotalSuccess}건`}><title>{`${time}시 성공: ${entryTotalSuccess}건`}</title></rect>
                                </>
                            )}
                            <text x={groupX - barWidth / 2} y={chartHeight - padding.bottom + 15} textAnchor="middle" fontSize="10" fill="var(--primary-text-color)">{time}시</text>
                        </g>
                    );
                })}
            </svg>
            <div className="chart-legend">
                <div><span className="legend-color-box" style={{backgroundColor: '#a9cce3'}}></span> 인입 콜</div>
                <div><span className="legend-color-box" style={{backgroundColor: 'var(--success-color)'}}></span> 유치 성공</div>
            </div>
        </div>
    );
};

const WeightDistributionBar: React.FC<{ weights: { [key: number]: number } }> = ({ weights }) => {
    const colors = ['#3498db', '#2ecc71', '#f1c40f', '#e67e22'];
    
    const intervalWeights = useMemo(() => {
        let lastWeight = 0;
        return REPORTING_TIMES.map(time => {
            const currentCumulativeWeight = weights[time] || 0;
            const intervalWeight = currentCumulativeWeight - lastWeight;
            lastWeight = currentCumulativeWeight;
            return { time, weight: intervalWeight };
        });
    }, [weights]);

    return (
        <div className="weight-distribution-bar" title="시간대별 가중치 분포">
            {intervalWeights.map(({ time, weight }, index) => (
                <div
                    key={time}
                    className="weight-bar-segment"
                    style={{
                        width: `${weight}%`,
                        backgroundColor: colors[index % colors.length],
                    }}
                    title={`${REPORTING_TIMES[index-1] || '업무 시작'} ~ ${time}시: ${weight}%`}
                />
            ))}
        </div>
    );
};

// Simple encryption/obfuscation helpers for local storage
const encryptKey = (text: string) => {
    if (!text) return '';
    try {
        return btoa(text.split('').map((char) => String.fromCharCode(char.charCodeAt(0) ^ 123)).join(''));
    } catch (e) {
        console.error("Encryption failed", e);
        return '';
    }
};

const decryptKey = (encrypted: string) => {
    if (!encrypted) return '';
    try {
        return atob(encrypted).split('').map((char) => String.fromCharCode(char.charCodeAt(0) ^ 123)).join('');
    } catch (e) {
        console.error("Decryption failed", e);
        return '';
    }
};

const ApiKeyManager: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const [apiKey, setApiKey] = useState('');
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [statusMessage, setStatusMessage] = useState('');

    useEffect(() => {
        if (isOpen) {
            const savedKey = localStorage.getItem('user_api_key_enc');
            if (savedKey) {
                setApiKey(decryptKey(savedKey));
            } else {
                setApiKey('');
            }
            setTestStatus('idle');
            setStatusMessage('');
        }
    }, [isOpen]);

    const handleSave = () => {
        if (!apiKey.trim()) {
            setStatusMessage('API Key를 입력해주세요.');
            setTestStatus('error');
            return;
        }
        try {
            const encrypted = encryptKey(apiKey.trim());
            localStorage.setItem('user_api_key_enc', encrypted);
            setTestStatus('success');
            setStatusMessage('API Key가 안전하게 저장되었습니다.');
            setTimeout(() => {
                onClose();
            }, 1500);
        } catch (e) {
            setTestStatus('error');
            setStatusMessage('저장 중 오류가 발생했습니다.');
        }
    };

    const handleTestConnection = async () => {
        if (!apiKey.trim()) {
            setStatusMessage('API Key를 입력해주세요.');
            setTestStatus('error');
            return;
        }
        setTestStatus('testing');
        setStatusMessage('연결 테스트 중...');
        
        try {
            // Using a public endpoint from Google Generative AI to test authentication
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`);
            if (response.ok) {
                setTestStatus('success');
                setStatusMessage('연결 성공! 유효한 API Key입니다.');
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || '연결 실패');
            }
        } catch (error: any) {
            setTestStatus('error');
            setStatusMessage(`연결 실패: ${error.message}`);
        }
    };

    const handleClear = () => {
        localStorage.removeItem('user_api_key_enc');
        setApiKey('');
        setTestStatus('idle');
        setStatusMessage('저장된 Key가 삭제되었습니다.');
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h3>API Key 관리 (외장형)</h3>
                    <button className="close-button" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body">
                    <p className="modal-description">
                        Google Gemini API Key를 입력하세요. 입력된 키는 로컬 브라우저에 암호화되어 저장되며, 서버로 전송되지 않습니다.
                    </p>
                    <div className="input-group-vertical">
                        <label htmlFor="apiKeyInput">Gemini API Key</label>
                        <input 
                            type="password" 
                            id="apiKeyInput" 
                            value={apiKey} 
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="AIza..."
                        />
                    </div>
                    
                    <div className={`status-message ${testStatus}`}>
                        {statusMessage}
                    </div>

                    <div className="modal-actions">
                        <button className="button-secondary" onClick={handleTestConnection} disabled={testStatus === 'testing'}>
                            {testStatus === 'testing' ? '테스트 중...' : '연결 테스트'}
                        </button>
                        <button className="button-primary" onClick={handleSave} disabled={testStatus === 'testing'}>
                            저장 및 닫기
                        </button>
                    </div>
                    <div className="modal-footer-actions">
                         <button className="text-button-danger" onClick={handleClear}>저장된 Key 삭제</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ManualContent: React.FC = () => (
     <>
        <h3>1. 대시보드 철학 및 소개</h3>
        <p>이 대시보드는 맞춤제안팀의 성과를 단순히 기록하는 것을 넘어, 데이터를 통해 미래를 예측하고 전략적인 의사결정을 지원하기 위해 설계되었습니다. 실시간 데이터 입력, 과학적 성과 예측, 그리고 다각적인 성과 분석 기능을 통해 팀의 잠재력을 최대한 이끌어내는 것을 목표로 합니다.</p>
        
        <h3>2. 시작하기: 핵심 워크플로우</h3>
        <ol>
            <li><strong>팀 선택 (헤더):</strong> 상단 헤더의 팀 선택 버튼(1팀/2팀)을 사용하여 관리할 팀을 선택합니다. 모든 데이터는 팀별로 독립적으로 저장됩니다.</li>
            <li><strong>초기 설정 (설정 시트):</strong> 매월 초, '설정' 시트에서 '상품별 월간 목표'와 '월간 핵심 목표'를 설정합니다. 팀의 성과 패턴에 맞춰 '예측 모델 가중치'를 조정할 수도 있습니다. 설정 후 반드시 '설정 저장' 버튼을 눌러주세요.</li>
            <li><strong>일일 실적 입력 (일일 보고서 시트):</strong> 11시, 14시, 16시, 18시 보고 시간에 맞춰 '일일 보고서' 시트 하단의 입력란에 실적을 입력합니다. 입력 즉시 모든 차트와 데이터가 실시간으로 업데이트됩니다. (자동 저장)</li>
            <li><strong>성과 모니터링 및 예측 (일일 보고서 시트):</strong> 상단의 '실시간 성과 요약'으로 현재 KPI를 확인하고, '일 목표 달성 예측'으로 최종 성과를 예측하며 업무 강도를 조절합니다. <strong>'What-if 시뮬레이션'</strong> 슬라이더를 움직여 남은 시간 노력 강도에 따른 결과를 예측해볼 수 있습니다.</li>
            <li><strong>월간 성과 분석 (월간 현황 시트):</strong> '월간 현황' 시트에서 상품별 실적, 핵심 목표 달성률 등을 종합적으로 검토하고, '월간 실적 수정' 기능으로 필요시 데이터를 보정합니다.</li>
            <li><strong>마감 및 보고 (헤더):</strong> 업무 종료 후, 우측 상단의 '데이터 관리' 버튼을 통해 CSV 파일 또는 이미지로 보고서를 생성하고, 과거 데이터를 조회하며 성과를 복기합니다.</li>
        </ol>

        <h3>3. 시트별 상세 기능 안내</h3>
        <h4>일일 보고서 시트</h4>
        <p>하루의 성과를 입력하고 분석하는 핵심 워크스페이스입니다.</p>
        <ul>
            <li><strong>핵심 요약/예측:</strong> 상단에는 현재까지의 누적 실적과 최종 예측치가 항상 표시되어, 일일 성과의 전체 그림을 한눈에 파악할 수 있습니다.</li>
            <li><strong>AI 액션 가이드:</strong> 목표 달성 예측 카드 하단에 현재 상황을 분석하여 구체적인 행동 지침(부족한 건수, 집중 상품 등)을 AI가 제안합니다.</li>
            <li><strong>데이터 테이블:</strong> 시간대별로 입력된 모든 상세 데이터를 보여줍니다. 각 행의 '수정', '삭제' 버튼으로 데이터를 관리할 수 있습니다.</li>
            <li><strong>데이터 입력 행:</strong> 테이블 하단에 위치한 입력 영역에서 새로운 실적을 추가하거나, 기존 실적을 수정할 수 있습니다.</li>
        </ul>
        <h4>월간 현황 시트</h4>
        <p>월 단위의 성과를 종합적으로 추적하고 관리합니다.</p>
        <ul>
            <li><strong>상품별 월간 실적:</strong> 상품별 월 목표 대비 누적 달성률을 시각적으로 보여줍니다. '실적 수정' 기능을 통해 월초 실적 이관 등 수동 조정이 가능합니다.</li>
             <li><strong>월간 핵심 목표 현황:</strong> 개통, 시도율 등 주요 KPI의 월 목표 대비 성과를 추적합니다. '목표 페이싱 분석'을 통해 현재 진행 속도가 목표 대비 빠른지 느린지 진단해줍니다.</li>
        </ul>
        <h4>설정 시트</h4>
        <p>대시보드의 모든 기준 정보와 계산 방식을 설정합니다.</p>
        <ul>
            <li><strong>상품별 월간 목표:</strong> 월별로 판매할 상품과 목표를 자유롭게 추가, 수정, 삭제할 수 있습니다.</li>
            <li><strong>월간 핵심 목표:</strong> 개통, 시도율 등 주요 KPI의 월간 목표치를 설정합니다.</li>
            <li><strong>예측 모델 설정:</strong> 팀의 고유한 성과 패턴을 가중치에 반영하여 예측 정확도를 극대화할 수 있습니다.</li>
            <li><strong>월별 영업일 설정:</strong> 공휴일을 자동 계산하여 순영업일과 개통가능일을 보여주며, 필요시 직접 수정할 수 있습니다.</li>
            <li><strong>설정 저장:</strong> 모든 설정 변경 후, 하단의 '설정 저장' 버튼을 클릭해야 변경사항이 영구적으로 반영됩니다.</li>
        </ul>
    </>
);

const Tooltip: React.FC<{ text: string }> = ({ text }) => (
    <span className="tooltip-container">
        <span className="tooltip-icon">?</span>
        <span className="tooltip-text">{text}</span>
    </span>
);


type ActiveTab = 'daily' | 'monthly' | 'settings' | 'manual';

const App: React.FC = () => {
    const [displayDate, setDisplayDate] = useState<string>(today);
    const [selectedTeam, setSelectedTeam] = useState<TeamType>('team1');
    const [entries, setEntries] = useState<ReportEntry[]>([]);
    const [newEntry, setNewEntry] = useState<Omit<ReportEntry, 'reportingTime'> & { reportingTime: number | 0 }>({ reportingTime: REPORTING_TIMES[0], calls: 0, memoAttempts: 0, managerAttempts: 0, sttAttempts: 0, productSuccesses: {}, activations: 0 });
    const [predictionWeights, setPredictionWeights] = useState<{ [key: number]: number }>(DEFAULT_WEIGHTS);
    const [monthInfoOverrides, setMonthInfoOverrides] = useState<MonthInfoOverrides | null>(null);
    const [monthlyGoals, setMonthlyGoals] = useState(DEFAULT_MONTHLY_GOALS);
    const [monthlyProductGoals, setMonthlyProductGoals] = useState<ProductGoal[]>(DEFAULT_PRODUCT_GOALS);
    const [monthlyProgress, setMonthlyProgress] = useState<{ products: { [productName: string]: number }, activations: number }>({ products: {}, activations: 0 });
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [editingTime, setEditingTime] = useState<number | null>(null);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<string>('overall');
    const [isEditingMonthlyProgress, setIsEditingMonthlyProgress] = useState(false);
    const [editableMonthlyProgress, setEditableMonthlyProgress] = useState<{ products: { [productName: string]: number } }>({ products: {} });
    const [isMonthlyProgressOverridden, setIsMonthlyProgressOverridden] = useState(false);
    const [progressTrigger, setProgressTrigger] = useState(0);
    const [activeTab, setActiveTab] = useState<ActiveTab>('daily');
    const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
    const [simulationAdjustment, setSimulationAdjustment] = useState<number>(0);
    
    const isReadOnly = displayDate !== today;
    
    const getStorageKey = useCallback((date: string, team: TeamType) => {
        return `performance-dashboard-${team}-${date}`;
    }, []);

    const getMonthlyOverrideKey = useCallback((monthKey: string, team: TeamType) => {
        return `monthly-overrides-${team}-${monthKey}`;
    }, []);

    const calculatedMonthInfo = useMemo(() => {
        return getMonthInfo(displayDate);
    }, [displayDate]);

    const displayedMonthInfo = useMemo(() => {
        return {
            openingDays: monthInfoOverrides?.openingDays ?? calculatedMonthInfo.openingDays,
            netApplicationDays: monthInfoOverrides?.netApplicationDays ?? calculatedMonthInfo.netApplicationDays,
        };
    }, [calculatedMonthInfo, monthInfoOverrides]);

    const workdayProgress = useMemo(() => {
        const date = new Date(displayDate.replace(/-/g, '/'));
        const currentMonth = new Date(today.replace(/-/g, '/')).getMonth();
        if (date.getMonth() < currentMonth) {
            return 100;
        }
        const passedWorkdays = getPassedWorkdays(displayDate);
        const totalWorkdays = displayedMonthInfo.netApplicationDays;
        if (totalWorkdays === 0) return 0;
        return (passedWorkdays / totalWorkdays) * 100;
    }, [displayDate, displayedMonthInfo]);

    const openingDayProgress = useMemo(() => {
        const date = new Date(displayDate.replace(/-/g, '/'));
        const currentMonth = new Date(today.replace(/-/g, '/')).getMonth();
        if (date.getMonth() < currentMonth) {
            return 100;
        }
        const passedDays = getPassedOpeningDays(displayDate);
        const totalDays = displayedMonthInfo.openingDays;
        if (totalDays === 0) return 0;
        return (passedDays / totalDays) * 100;
    }, [displayDate, displayedMonthInfo]);


    const showToast = (message: string, type: Toast['type'] = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    };
    
    useEffect(() => {
        setSimulationAdjustment(0);
    }, [displayDate, selectedTeam]);

    useEffect(() => {
        // Data Loading Logic
        const STORAGE_KEY = getStorageKey(displayDate, selectedTeam);
        
        let savedData: string | null = null;
        try {
            savedData = localStorage.getItem(STORAGE_KEY);
            // Migration/Fallback: If no data for specific team key, and it's team1, try legacy key
            if (!savedData && selectedTeam === 'team1') {
                const legacyKey = `performance-dashboard-${displayDate}`;
                savedData = localStorage.getItem(legacyKey);
            }
        } catch (e) {
            console.error("Error reading from local storage", e);
        }

        if (savedData) {
            try {
                const parsedData = JSON.parse(savedData);
                setEntries(parsedData.entries || []);
                setPredictionWeights(parsedData.predictionWeights || DEFAULT_WEIGHTS);
                setMonthInfoOverrides(parsedData.monthInfoOverrides || null);
                setMonthlyGoals(parsedData.monthlyGoals || DEFAULT_MONTHLY_GOALS);
                setMonthlyProductGoals(parsedData.monthlyProductGoals && parsedData.monthlyProductGoals.length > 0 ? parsedData.monthlyProductGoals : DEFAULT_PRODUCT_GOALS);
            } catch (e) {
                console.error("Error parsing data", e);
                // Fallback to defaults on error
                setEntries([]);
                setPredictionWeights(DEFAULT_WEIGHTS);
                setMonthInfoOverrides(null);
                setMonthlyGoals(DEFAULT_MONTHLY_GOALS);
                setMonthlyProductGoals(DEFAULT_PRODUCT_GOALS);
            }
        } else {
            // Defaults
            setEntries([]);
            setPredictionWeights(DEFAULT_WEIGHTS);
            setMonthInfoOverrides(null);
            setMonthlyGoals(DEFAULT_MONTHLY_GOALS);
            setMonthlyProductGoals(DEFAULT_PRODUCT_GOALS);
        }
    }, [displayDate, selectedTeam, getStorageKey]);
    
    useEffect(() => {
        const date = new Date(displayDate.replace(/-/g, '/'));
        const year = date.getFullYear();
        const month = date.getMonth();
        const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
        const OVERRIDE_KEY = getMonthlyOverrideKey(monthKey, selectedTeam);
        
        try {
            const savedOverrides = localStorage.getItem(OVERRIDE_KEY);
            if (savedOverrides) {
                const parsedOverrides = JSON.parse(savedOverrides);
                setMonthlyProgress(parsedOverrides);
                setIsMonthlyProgressOverridden(true);
                return; 
            }
        } catch (error) {
            console.error("Error reading monthly overrides", error);
        }

        setIsMonthlyProgressOverridden(false);
        const progress: { products: { [productName: string]: number }, activations: number } = {
            products: {},
            activations: 0
        };
        monthlyProductGoals.forEach(p => progress.products[p.name] = 0);

        for (let day = 1; day <= 31; day++) {
            const loopDate = new Date(year, month, day);
            if (loopDate.getMonth() !== month) break;

            const dateString = loopDate.toISOString().split('T')[0];
            const STORAGE_KEY = getStorageKey(dateString, selectedTeam);
            
            let savedData: string | null = null;
            try {
                savedData = localStorage.getItem(STORAGE_KEY);
                // Fallback read for team1
                if (!savedData && selectedTeam === 'team1') {
                    savedData = localStorage.getItem(`performance-dashboard-${dateString}`);
                }

                if (savedData) {
                    const parsedData = JSON.parse(savedData);
                    if (parsedData.entries && Array.isArray(parsedData.entries)) {
                        parsedData.entries.forEach((entry: ReportEntry) => {
                            if (entry.productSuccesses) {
                                Object.entries(entry.productSuccesses).forEach(([name, count]) => {
                                    if (progress.products.hasOwnProperty(name)) {
                                        progress.products[name] += count;
                                    }
                                });
                            }
                            if (entry.activations) {
                                progress.activations += entry.activations;
                            }
                        });
                    }
                }
            } catch (error) {
                // Ignore parsing errors
            }
        }
        setMonthlyProgress(progress);
    }, [displayDate, monthlyProductGoals, progressTrigger, selectedTeam, getMonthlyOverrideKey, getStorageKey]);


    useEffect(() => {
        if (!isReadOnly) {
            try {
                const STORAGE_KEY = getStorageKey(today, selectedTeam);
                // Always write to the new key structure.
                // We also need to preserve settings if we are just updating entries.
                // But here we are constructing the object to save.
                // To avoid overwriting settings with defaults if they weren't loaded yet (unlikely due to effect order),
                // we should include all current state.
                
                const dataToSave = {
                    entries,
                    predictionWeights,
                    monthInfoOverrides,
                    monthlyGoals,
                    monthlyProductGoals
                };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
            } catch (error) {
                console.error("Could not save entry data to localStorage", error);
            }
        }
    }, [entries, isReadOnly, selectedTeam, getStorageKey, predictionWeights, monthInfoOverrides, monthlyGoals, monthlyProductGoals]);

    const dailyGoal = useMemo(() => {
        if (displayedMonthInfo.netApplicationDays === 0) return 0;
        const totalMonthlyGoal = monthlyProductGoals.reduce((sum, p) => sum + p.goal, 0);
        return totalMonthlyGoal / displayedMonthInfo.netApplicationDays;
    }, [monthlyProductGoals, displayedMonthInfo.netApplicationDays]);


    const summary = useMemo(() => {
        const totalCalls = entries.reduce((sum, entry) => sum + entry.calls, 0);
        const totalMemoAttempts = entries.reduce((sum, entry) => sum + entry.memoAttempts, 0);
        const totalManagerAttempts = entries.reduce((sum, entry) => sum + entry.managerAttempts, 0);
        const totalSttAttempts = entries.reduce((sum, entry) => sum + entry.sttAttempts, 0);
        const totalSuccesses = entries.reduce((sum, entry) => sum + Object.values(entry.productSuccesses).reduce<number>((s, c) => s + Number(c), 0), 0);
        const totalActivations = entries.reduce((sum, entry) => sum + (entry.activations || 0), 0);

        const mentionRate = totalCalls > 0 ? (totalMemoAttempts / totalCalls) * 100 : 0;
        const activeAttemptRate = totalCalls > 0 ? (totalManagerAttempts / totalCalls) * 100 : 0;
        const sttMentionRate = totalCalls > 0 ? (totalSttAttempts / totalCalls) * 100 : 0;
        const conversionRate = totalManagerAttempts > 0 ? (totalSuccesses / totalManagerAttempts) * 100 : 0;
        const activationRate = totalSuccesses > 0 ? (totalActivations / totalSuccesses) * 100 : 0;

        const currentAchievement = dailyGoal > 0 ? (totalSuccesses / dailyGoal) * 100 : 0;

        const lastReportingTime = entries.length > 0 ? Math.max(...entries.map(e => e.reportingTime)) : 0;
        
        const cumulativeWeight = lastReportingTime > 0 ? predictionWeights[lastReportingTime] || 0 : 0;

        const predictedSuccesses = cumulativeWeight > 0 
            ? (totalSuccesses / (cumulativeWeight / 100))
            : totalSuccesses;
        
        const predictedActivations = cumulativeWeight > 0 
            ? (totalActivations / (cumulativeWeight / 100))
            : totalActivations;

        const predictedAchievement = dailyGoal > 0 ? (predictedSuccesses / dailyGoal) * 100 : 0;

        const dailyActivationGoal = displayedMonthInfo.openingDays > 0 ? (monthlyGoals.activationGoal / displayedMonthInfo.openingDays) : 0;
        const currentActivationAchievement = dailyActivationGoal > 0 ? (totalActivations / dailyActivationGoal) * 100 : 0;
        const predictedActivationAchievement = dailyActivationGoal > 0 ? (predictedActivations / dailyActivationGoal) * 100 : 0;

        const productSummaries: { [productName: string]: any } = {};
        for (const goal of monthlyProductGoals) {
            const productName = goal.name;
            const productSuccesses = entries.reduce((sum, entry) => sum + (entry.productSuccesses[productName] || 0), 0);
            
            const predictedProductSuccesses = cumulativeWeight > 0 
                ? (productSuccesses / (cumulativeWeight / 100))
                : productSuccesses;

            const dailyProductGoal = displayedMonthInfo.netApplicationDays > 0 ? (goal.goal / displayedMonthInfo.netApplicationDays) : 0;
            
            productSummaries[productName] = {
                totalSuccesses: productSuccesses,
                predictedSuccesses: predictedProductSuccesses,
                dailyGoal: dailyProductGoal,
                currentAchievement: dailyProductGoal > 0 ? (productSuccesses / dailyProductGoal) * 100 : 0,
                predictedAchievement: dailyProductGoal > 0 ? (predictedProductSuccesses / dailyProductGoal) * 100 : 0,
            };
        }

        return {
            totalCalls,
            totalMemoAttempts,
            totalManagerAttempts,
            totalSttAttempts,
            totalSuccesses,
            totalActivations,
            mentionRate,
            activeAttemptRate,
            sttMentionRate,
            conversionRate,
            activationRate,
            currentAchievement,
            predictedAchievement,
            predictedSuccesses,
            predictedActivations,
            dailyActivationGoal,
            currentActivationAchievement,
            predictedActivationAchievement,
            productSummaries,
        };
    }, [entries, dailyGoal, predictionWeights, monthlyProductGoals, displayedMonthInfo.netApplicationDays, displayedMonthInfo.openingDays, monthlyGoals.activationGoal]);
    
    // Simulation Logic
    const simulationData = useMemo(() => {
        const lastReportingTime = entries.length > 0 ? Math.max(...entries.map(e => e.reportingTime)) : 0;
        const hoursPassed = HOURS_PASSED_MAP[lastReportingTime] || 0;
        const remainingHours = Math.max(TOTAL_WORK_DURATION - hoursPassed, 0);

        let basePredicted = summary.predictedSuccesses;
        let goal = dailyGoal;
        
        if (selectedProduct !== 'overall') {
            basePredicted = summary.productSummaries[selectedProduct]?.predictedSuccesses || 0;
            goal = summary.productSummaries[selectedProduct]?.dailyGoal || 0;
        }

        const additionalFromSim = simulationAdjustment * remainingHours;
        const simulatedTotal = Math.max(0, basePredicted + additionalFromSim);
        const simulatedAchievement = goal > 0 ? (simulatedTotal / goal) * 100 : 0;

        let guideMessage = "";
        let guideType = "neutral"; 

        if (remainingHours <= 0) {
            guideMessage = "오늘 업무가 종료되었습니다. 수고하셨습니다!";
        } else {
            const gap = goal - basePredicted;
            if (gap <= 0) {
                guideMessage = `🎉 현재 페이스가 아주 좋습니다! 이대로라면 목표를 ${Math.abs(gap).toFixed(0)}건 초과 달성할 것으로 예상됩니다.`;
                guideType = "success";
            } else {
                const requiredPerHour = gap / remainingHours;
                guideMessage = `🚨 현재 추세라면 목표 대비 ${gap.toFixed(0)}건 부족합니다. 남은 시간(${remainingHours}시간) 동안 시간당 약 ${Math.max(0, (requiredPerHour)).toFixed(1)}건의 추가 성과가 필요합니다.`;
                guideType = "danger";
                
                if (selectedProduct === 'overall') {
                    const worstProduct = monthlyProductGoals
                        .map(p => ({
                            name: p.name,
                            gap: (summary.productSummaries[p.name]?.dailyGoal || 0) - (summary.productSummaries[p.name]?.predictedSuccesses || 0)
                        }))
                        .sort((a, b) => b.gap - a.gap)[0];
                    
                    if (worstProduct && worstProduct.gap > 0) {
                        guideMessage += ` 특히 '${worstProduct.name}'에 집중해보세요.`;
                    }
                }
            }
        }

        return {
            simulatedTotal,
            simulatedAchievement,
            guideMessage,
            guideType,
            remainingHours
        };
    }, [entries, summary, dailyGoal, simulationAdjustment, selectedProduct, monthlyProductGoals]);

    // Previous Day Comparison Logic
    const previousDate = useMemo(() => getPreviousDay(displayDate), [displayDate]);
    const comparisonMetrics = useMemo(() => {
        if (entries.length === 0) return null;
        
        const currentMaxTime = Math.max(...entries.map(e => e.reportingTime));
        const STORAGE_KEY = getStorageKey(previousDate, selectedTeam);
        
        try {
            let savedData = localStorage.getItem(STORAGE_KEY);
            if (!savedData && selectedTeam === 'team1') {
                 savedData = localStorage.getItem(`performance-dashboard-${previousDate}`);
            }

            if (savedData) {
                const parsed = JSON.parse(savedData);
                const prevEntries: ReportEntry[] = parsed.entries || [];
                
                // Filter entries up to the current time
                const relevantEntries = prevEntries.filter(e => e.reportingTime <= currentMaxTime);
                
                const prevSuccesses = relevantEntries.reduce((sum, entry) => sum + Object.values(entry.productSuccesses).reduce<number>((s, c) => s + Number(c), 0), 0);
                const prevActivations = relevantEntries.reduce((sum, entry) => sum + (entry.activations || 0), 0);
                
                return {
                    successes: prevSuccesses,
                    activations: prevActivations
                };
            }
        } catch (e) {
            return null;
        }
        return null;
    }, [displayDate, entries, previousDate, selectedTeam, getStorageKey]);

    const renderTrend = (current: number, previous: number | undefined) => {
       if (previous === undefined || previous === null) return null;
       const diff = current - previous;
       if (diff === 0) return <span className="trend-neutral">-</span>;
       const percent = previous !== 0 ? ((diff / previous) * 100).toFixed(0) : (diff > 0 ? '100' : '0');
       const isPositive = diff > 0;
       
       return (
           <span className={`trend-indicator ${isPositive ? 'trend-up' : 'trend-down'}`}>
               {isPositive ? '▲' : '▼'} {Math.abs(Number(percent))}%
               <span className="trend-tooltip">전일 동시간 대비 {diff > 0 ? '+' : ''}{diff}건</span>
           </span>
       );
    };


    const getPredictionFeedback = (percentage: number) => {
        if (percentage >= 100) {
            return {
                message: "목표 달성 청신호! 현재 페이스를 유지하세요.",
                className: "feedback-good"
            };
        }
        if (percentage >= 80) {
            return {
                message: "달성 가능권! 막판 스퍼트가 필요합니다.",
                className: "feedback-warning"
            };
        }
        return {
            message: "주의! 목표 달성을 위해 즉각적인 액션이 필요합니다.",
            className: "feedback-danger"
        };
    };

    const getPacingStatus = (actualCompletion: number, expectedProgress: number) => {
        if (isNaN(actualCompletion) || isNaN(expectedProgress) || expectedProgress === 0) {
            return { message: '데이터 부족', className: 'pacing-neutral' };
        }
        if (actualCompletion >= expectedProgress) {
            return { message: '목표 초과 달성 중', className: 'pacing-good' };
        }
        if (actualCompletion < expectedProgress * 0.95) { // 5% 이상 뒤쳐지면 '부진'
            return { message: '목표 대비 부진', className: 'pacing-danger' };
        }
        return { message: '정상 진행 중', className: 'pacing-warning' };
    };

    const predictionFeedback = getPredictionFeedback(
        selectedProduct === 'overall' 
            ? summary.predictedAchievement 
            : summary.productSummaries[selectedProduct]?.predictedAchievement || 0
    );
    
    const availableReportingTimes = useMemo(() => {
        const enteredTimes = new Set(entries.map(e => e.reportingTime));
        const available = REPORTING_TIMES.filter(t => !enteredTimes.has(t));
        if (editingTime && !available.includes(editingTime)) {
            available.push(editingTime);
            available.sort((a,b) => a - b);
        }
        return available;
    }, [entries, editingTime]);

    const handleAddEntry = (e: React.FormEvent) => {
        e.preventDefault();
        const totalSuccesses = Object.values(newEntry.productSuccesses).reduce<number>((s, c) => s + Number(c), 0);
        if (newEntry.calls < 0 || newEntry.memoAttempts < 0 || newEntry.managerAttempts < 0 || newEntry.sttAttempts < 0 || totalSuccesses < 0 || newEntry.activations < 0) {
            showToast("입력값은 0 이상이어야 합니다.", 'warning');
            return;
        }

        if (totalSuccesses > newEntry.calls) {
            showToast("총 성공 건수는 인입 콜 수보다 많을 수 없습니다.", 'warning');
            return;
        }
         if (totalSuccesses > newEntry.managerAttempts) {
            showToast("총 성공 건수는 관리자 확인 시도보다 많을 수 없습니다.", 'warning');
            return;
        }
        if (newEntry.activations > totalSuccesses) {
            showToast("개통 건수는 총 성공 건수보다 많을 수 없습니다.", 'warning');
            return;
        }

        const isEditing = editingTime !== null;
        if (!isEditing && entries.some(entry => entry.reportingTime === newEntry.reportingTime)) {
            showToast("해당 시간대의 데이터가 이미 존재합니다.", 'warning');
            return;
        }

        let updatedEntries;
        const entryToSave = { ...newEntry, reportingTime: newEntry.reportingTime || 0 };

        if (isEditing) {
            updatedEntries = entries.map(entry => entry.reportingTime === editingTime ? entryToSave : entry);
        } else {
            updatedEntries = [...entries, entryToSave];
        }

        const sortedEntries = updatedEntries.sort((a, b) => a.reportingTime - b.reportingTime);
        setEntries(sortedEntries as ReportEntry[]);
        
        if (isEditing) {
            showToast('✅ 데이터가 수정되었습니다.');
            setEditingTime(null);
        } else {
            showToast('✅ 실적이 추가되었습니다.');
        }

        const nextAvailableTimes = REPORTING_TIMES.filter(t => !sortedEntries.map(e => e.reportingTime).includes(t));

        const initialProductSuccesses = monthlyProductGoals.reduce((acc, p) => ({ ...acc, [p.name]: 0 }), {});
        if(nextAvailableTimes.length > 0) {
            setNewEntry({ reportingTime: nextAvailableTimes[0], calls: 0, memoAttempts: 0, managerAttempts: 0, sttAttempts: 0, productSuccesses: initialProductSuccesses, activations: 0 });
        } else {
            setNewEntry({ reportingTime: 0, calls: 0, memoAttempts: 0, managerAttempts: 0, sttAttempts: 0, productSuccesses: initialProductSuccesses, activations: 0 });
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setNewEntry(prev => ({ ...prev, [name]: parseInt(value) || 0 }));
    };

    const handleProductSuccessChange = (productName: string, value: string) => {
        setNewEntry(prev => ({
            ...prev,
            productSuccesses: {
                ...prev.productSuccesses,
                [productName]: parseInt(value) || 0
            }
        }));
    };

    const handleWeightChange = (time: number, value: string) => {
        const newWeights = { ...predictionWeights, [time]: parseInt(value) || 0 };
        setPredictionWeights(newWeights);
    };
    
    const handleResetWeights = () => {
        setPredictionWeights(DEFAULT_WEIGHTS);
        showToast('ℹ️ 가중치가 기본값으로 복원되었습니다.', 'info');
    };

    const handleMonthInfoChange = (key: 'openingDays' | 'netApplicationDays', value: string) => {
        const numValue = parseInt(value, 10);
        const newOverrides = { ...(monthInfoOverrides || {}) };

        if (!isNaN(numValue) && numValue >= 0) {
            newOverrides[key] = numValue;
        } else {
            delete newOverrides[key];
        }

        if (Object.keys(newOverrides).length === 0) {
            setMonthInfoOverrides(null);
        } else {
            setMonthInfoOverrides(newOverrides as MonthInfoOverrides);
        }
    };

    const handleGoalChange = (key: keyof typeof monthlyGoals, value: string) => {
        const numValue = parseInt(value, 10);
        if (String(key).includes('Rate')) {
            if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
                setMonthlyGoals(prev => ({ ...prev, [key]: numValue }));
            } else if (value === '') {
                setMonthlyGoals(prev => ({ ...prev, [key]: 0 }));
            }
        } else {
            if (!isNaN(numValue) && numValue >= 0) {
                setMonthlyGoals(prev => ({ ...prev, [key]: numValue }));
            } else if (value === '') {
                setMonthlyGoals(prev => ({ ...prev, [key]: 0 }));
            }
        }
    };

    const handleProductGoalChange = (id: number, field: 'name' | 'goal', value: string | number) => {
        setMonthlyProductGoals(prev => prev.map(p => {
            if (p.id === id) {
                if(field === 'name') return { ...p, name: String(value) };
                if(field === 'goal') return { ...p, goal: Number(value) || 0 };
            }
            return p;
        }));
    };

    const addProductGoal = () => {
        setMonthlyProductGoals(prev => [...prev, { id: Date.now(), name: '', goal: 0 }]);
    };

    const removeProductGoal = (id: number) => {
        setMonthlyProductGoals(prev => prev.filter(p => p.id !== id));
    };

    const handleEditMonthlyProgress = () => {
        setEditableMonthlyProgress(JSON.parse(JSON.stringify(monthlyProgress))); // Deep copy
        setIsEditingMonthlyProgress(true);
    };

    const handleCancelEditMonthlyProgress = () => {
        setIsEditingMonthlyProgress(false);
        showToast('ℹ️ 월간 실적 수정을 취소했습니다.', 'info');
    };

    const handleSaveMonthlyProgress = () => {
        const date = new Date(displayDate.replace(/-/g, '/'));
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const monthKey = `${year}-${String(month).padStart(2, '0')}`;
        const OVERRIDE_KEY = getMonthlyOverrideKey(monthKey, selectedTeam);

        localStorage.setItem(OVERRIDE_KEY, JSON.stringify(editableMonthlyProgress));
        setMonthlyProgress(editableMonthlyProgress);
        setIsMonthlyProgressOverridden(true);
        setIsEditingMonthlyProgress(false);
        showToast('✅ 월간 실적을 수동으로 저장했습니다.');
    };

    const handleResetMonthlyProgress = () => {
        if (window.confirm('수동으로 입력된 월간 실적을 삭제하고 일일 데이터 기반으로 재계산하시겠습니까?')) {
            const date = new Date(displayDate.replace(/-/g, '/'));
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const monthKey = `${year}-${String(month).padStart(2, '0')}`;
            const OVERRIDE_KEY = getMonthlyOverrideKey(monthKey, selectedTeam);
            
            localStorage.removeItem(OVERRIDE_KEY);
            setProgressTrigger(t => t + 1); // Trigger recalculation
            setIsEditingMonthlyProgress(false);
            showToast('ℹ️ 월간 실적이 자동 계산값으로 복원되었습니다.');
        }
    };
    
    const handleSaveSettings = () => {
        if (isReadOnly) return;
        try {
            const STORAGE_KEY = getStorageKey(today, selectedTeam);
            // This is duplicative with the auto-save effect, but ensures explicit save action feedback
            const dataToSave = {
                entries,
                predictionWeights,
                monthInfoOverrides,
                monthlyGoals,
                monthlyProductGoals
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
            showToast('✅ 설정이 저장되었습니다.');
        } catch (error) {
            console.error("Could not save settings to localStorage", error);
            showToast('설정 저장에 실패했습니다.', 'warning');
        }
    };
    
    const handleEditableProgressChange = (productName: string, value: string) => {
        setEditableMonthlyProgress(prev => ({
            ...prev,
            products: {
                ...prev.products,
                [productName]: Number(value) || 0
            }
        }));
    };

    const finalWeight = useMemo(() => predictionWeights[REPORTING_TIMES[REPORTING_TIMES.length - 1]] || 0, [predictionWeights]);
    
    useEffect(() => {
        const enteredTimes = new Set(entries.map(e => e.reportingTime));
        const currentAvailableTimes = REPORTING_TIMES.filter(t => !enteredTimes.has(t));
        
        if (currentAvailableTimes.length > 0 && (newEntry.reportingTime === 0 || !currentAvailableTimes.includes(newEntry.reportingTime))) {
             if (editingTime === null) {
                setNewEntry(prev => ({ ...prev, reportingTime: currentAvailableTimes[0]}));
             }
        }
    }, [entries, editingTime]);

    useEffect(() => {
        setNewEntry(prev => {
            const newProductSuccesses = { ...prev.productSuccesses };
            monthlyProductGoals.forEach(p => {
                if (!newProductSuccesses.hasOwnProperty(p.name)) {
                    newProductSuccesses[p.name] = 0;
                }
            });
            return { ...prev, productSuccesses: newProductSuccesses };
        });
    }, [monthlyProductGoals]);

    const renderDifference = (val1: number, val2: number) => {
        const diff = val1 - val2;
        if (diff === 0) return <span className="diff-zero">0</span>;
        const sign = diff > 0 ? '+' : '';
        return <span className={diff > 0 ? 'diff-positive' : 'diff-negative'}>{sign}{diff}</span>;
    };

    const handleDownloadCSV = () => {
        const headers = [
            '날짜', '팀', '총 인입 콜', '총 성공 건수', '총 개통 건수', `일일 목표(${dailyGoal.toFixed(1)})`,
            '시도율(메모)', '적극 시도율(확인)', 'STT 언급률', '성공률(확인)', '개통률(성공)',
            '현재 달성률', '예상 성공 건수', '예상 달성률'
        ].join(',');

        const row = [
            displayDate,
            selectedTeam === 'team1' ? '1팀' : '2팀',
            summary.totalCalls,
            summary.totalSuccesses,
            summary.totalActivations,
            dailyGoal.toFixed(1),
            `${summary.mentionRate.toFixed(1)}%`,
            `${summary.activeAttemptRate.toFixed(1)}%`,
            `${summary.sttMentionRate.toFixed(1)}%`,
            `${summary.conversionRate.toFixed(1)}%`,
            `${summary.activationRate.toFixed(1)}%`,
            `${summary.currentAchievement.toFixed(1)}%`,
            Math.round(summary.predictedSuccesses),
            `${summary.predictedAchievement.toFixed(1)}%`
        ].join(',');

        const csvString = `${headers}\n${row}`;
        
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, csvString], { type: 'text/csv;charset=utf-8;' });
        
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `요약보고서_${selectedTeam}_${displayDate}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            showToast('ℹ️ 요약 보고서가 저장되었습니다.', 'info');
        }
    };
    
    const handleDownloadDetailCSV = () => {
        const productNames = monthlyProductGoals.map(p => p.name);
        const headers = [
            '날짜', '팀', '보고 시간', '인입 콜', '메모 시도', '관리자 확인 시도', 'STT 감지 시도', '총 성공', '개통', ...productNames
        ].join(',');

        const rows = entries.map(entry => {
            const totalSuccesses = Object.values(entry.productSuccesses).reduce<number>((sum, count) => sum + Number(count), 0);
            const productSuccesses = productNames.map(name => entry.productSuccesses[name] || 0);
            return [
                displayDate,
                selectedTeam === 'team1' ? '1팀' : '2팀',
                `${entry.reportingTime}시`,
                entry.calls,
                entry.memoAttempts,
                entry.managerAttempts,
                entry.sttAttempts,
                totalSuccesses,
                entry.activations || 0,
                ...productSuccesses
            ].join(',');
        });

        const csvString = `${headers}\n${rows.join('\n')}`;
        
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, csvString], { type: 'text/csv;charset=utf-8;' });
        
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `상세성과_${selectedTeam}_${displayDate}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            showToast('ℹ️ 상세 데이터 CSV 파일이 저장되었습니다.', 'info');
        }
    };

    const handleDownloadImage = async () => {
        setIsGeneratingImage(true);
        const rootElement = document.getElementById('root');
        if (rootElement) {
            rootElement.classList.add('report-mode');
        }

        try {
            await new Promise(resolve => setTimeout(resolve, 100));

            const mainContent = document.querySelector('main');
            if (mainContent) {
                const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--bg-color').trim();
                const canvas = await html2canvas(mainContent, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: bgColor,
                });
                const link = document.createElement('a');
                link.download = `마감보고서_${selectedTeam}_${displayDate}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                showToast('ℹ️ 이미지가 저장되었습니다.', 'info');
            } else {
                console.error("Main content area not found for image capture.");
                showToast("이미지 생성에 실패했습니다.", 'warning');
            }
        } catch (error) {
            console.error("Error generating image:", error);
            showToast("이미지 생성 중 오류가 발생했습니다.", 'warning');
        } finally {
            if (rootElement) {
                rootElement.classList.remove('report-mode');
            }
            setIsGeneratingImage(false);
        }
    };
    
    const handleDeleteEntry = (reportingTimeToDelete: number) => {
        if (window.confirm(`${reportingTimeToDelete}시 보고 데이터를 삭제하시겠습니까?`)) {
            setEntries(prevEntries => prevEntries.filter(e => e.reportingTime !== reportingTimeToDelete));
            showToast('ℹ️ 데이터가 삭제되었습니다.', 'info');
        }
    };
    
    const handleResetToday = () => {
        if (window.confirm(`오늘 ${selectedTeam === 'team1' ? '1팀' : '2팀'}의 모든 실적 데이터를 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
            setEntries([]);
            showToast('ℹ️ 오늘 데이터가 초기화되었습니다.', 'info');
        }
    };
    
    const handleCancelEdit = () => {
        setEditingTime(null);
    
        const enteredTimes = new Set(entries.map(e => e.reportingTime));
        const nextAvailableTimes = REPORTING_TIMES.filter(t => !enteredTimes.has(t));
        const nextTime = nextAvailableTimes.length > 0 ? nextAvailableTimes[0] : 0;
        
        const initialProductSuccesses = monthlyProductGoals.reduce((acc, p) => ({ ...acc, [p.name]: 0 }), {});
        setNewEntry({ reportingTime: nextTime, calls: 0, memoAttempts: 0, managerAttempts: 0, sttAttempts: 0, productSuccesses: initialProductSuccesses, activations: 0 });
        showToast('ℹ️ 수정을 취소했습니다.', 'info');
    };

    const handleEditEntry = (entryToEdit: ReportEntry) => {
        setEditingTime(entryToEdit.reportingTime);
        setNewEntry(entryToEdit);
        document.querySelector('.data-input-form')?.scrollIntoView({ behavior: 'smooth' });
    };

    const attemptRateCompletion = monthlyGoals.attemptRate > 0 ? (summary.mentionRate / monthlyGoals.attemptRate) * 100 : 0;
    const attemptRateStatus = getPacingStatus(attemptRateCompletion, workdayProgress);

    const activeAttemptRateCompletion = monthlyGoals.activeAttemptRate > 0 ? (summary.activeAttemptRate / monthlyGoals.activeAttemptRate) * 100 : 0;
    const activeAttemptRateStatus = getPacingStatus(activeAttemptRateCompletion, workdayProgress);

    const sttMentionRateCompletion = monthlyGoals.sttMentionRate > 0 ? (summary.sttMentionRate / monthlyGoals.sttMentionRate) * 100 : 0;
    const sttMentionRateStatus = getPacingStatus(sttMentionRateCompletion, workdayProgress);

    const activationGoalCompletion = monthlyGoals.activationGoal > 0 ? (monthlyProgress.activations / monthlyGoals.activationGoal) * 100 : 0;
    const activationGoalStatus = getPacingStatus(activationGoalCompletion, openingDayProgress);

    const TABS: { id: ActiveTab, label: string }[] = [
        { id: 'daily', label: '일일 보고서' },
        { id: 'monthly', label: '월간 현황' },
        { id: 'settings', label: '설정' },
        { id: 'manual', label: '전체 메뉴얼' },
    ];

    return (
        <>
            <div className="toast-container">
                {toasts.map(toast => (
                    <div key={toast.id} className={`toast-notification toast-${toast.type}`}>
                        {toast.message}
                    </div>
                ))}
            </div>
            <ApiKeyManager isOpen={isApiKeyModalOpen} onClose={() => setIsApiKeyModalOpen(false)} />
            <header>
                <div className="header-content">
                    <h1>맞춤제안팀 성과 대시보드 <span className="team-badge">{selectedTeam === 'team1' ? '1팀' : '2팀'}</span></h1>
                    <p>{new Date(displayDate.replace(/-/g, '/')).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p>
                </div>
                <div className="header-actions">
                    <div className="team-selector-group">
                        <button 
                            className={`team-button ${selectedTeam === 'team1' ? 'active' : ''}`}
                            onClick={() => setSelectedTeam('team1')}
                        >
                            1팀
                        </button>
                        <button 
                            className={`team-button ${selectedTeam === 'team2' ? 'active' : ''}`}
                            onClick={() => setSelectedTeam('team2')}
                        >
                            2팀
                        </button>
                    </div>
                     <div className="action-group">
                       <label htmlFor="date-picker">성과 조회 날짜:</label>
                       <input
                         type="date"
                         id="date-picker"
                         value={displayDate}
                         onChange={(e) => setDisplayDate(e.target.value)}
                         max={today}
                       />
                    </div>
                    <div className="action-group report-hidden">
                        <button type="button" onClick={() => setIsApiKeyModalOpen(true)} className="button-secondary">
                            API Key 관리
                        </button>
                        <button type="button" onClick={handleDownloadCSV} className="button-secondary">
                            요약 CSV
                        </button>
                        <button type="button" onClick={handleDownloadDetailCSV} className="button-secondary">
                            상세 CSV
                        </button>
                         <button type="button" onClick={handleDownloadImage} className="button-secondary" disabled={isGeneratingImage}>
                            {isGeneratingImage ? '...' : '이미지 저장'}
                        </button>
                        <button type="button" onClick={handleResetToday} className="button-secondary button-danger" disabled={isReadOnly}>
                            초기화
                        </button>
                    </div>
                </div>
            </header>
            <main>
                <div className="tabs-container report-hidden">
                    {TABS.map(tab => (
                        <button 
                            key={tab.id} 
                            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="sheet-content">
                    {activeTab === 'daily' && (
                        <div className="sheet">
                            <div className="daily-summary-grid">
                                <div className="card" role="region" aria-labelledby="summary-title">
                                    <div className="prediction-title-wrapper">
                                        <h2 id="summary-title">실시간 성과 요약 ({selectedTeam === 'team1' ? '1팀' : '2팀'})</h2>
                                        <select className="product-selector" value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}>
                                            <option value="overall">전체</option>
                                            {monthlyProductGoals.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="kpi-grid">
                                        {selectedProduct === 'overall' ? (
                                            <>
                                                <div className="kpi-item">
                                                    <div className="value">{summary.totalSuccesses.toLocaleString()}건</div>
                                                    <div className="label">총 성공 건수</div>
                                                    {renderTrend(summary.totalSuccesses, comparisonMetrics?.successes)}
                                                </div>
                                                <div className="kpi-item">
                                                    <div className="value">{summary.totalActivations.toLocaleString()}건</div>
                                                    <div className="label">총 개통 건수</div>
                                                    {renderTrend(summary.totalActivations, comparisonMetrics?.activations)}
                                                </div>
                                                <div className="kpi-item" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                                     <div className="label" style={{ marginBottom: '0.5rem' }}>현재 달성률</div>
                                                    <CircularProgress 
                                                        value={summary.currentAchievement} 
                                                        max={100} 
                                                        size={140}
                                                        label="달성률"
                                                    />
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="kpi-item">
                                                    <div className="value">{(summary.productSummaries[selectedProduct]?.totalSuccesses || 0).toLocaleString()}건</div>
                                                    <div className="label">상품 성공 건수</div>
                                                </div>
                                                <div className="kpi-item">
                                                    <div className="value">{(summary.productSummaries[selectedProduct]?.dailyGoal || 0).toFixed(1)}건</div>
                                                    <div className="label">일일 목표</div>
                                                </div>
                                                <div className="kpi-item" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                                    <div className="label" style={{ marginBottom: '0.5rem' }}>상품 달성률</div>
                                                    <CircularProgress 
                                                        value={summary.productSummaries[selectedProduct]?.currentAchievement || 0}
                                                        max={100}
                                                        size={140}
                                                        label="달성률"
                                                        color="var(--info-color)"
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="card" role="region" aria-labelledby="prediction-title">
                                    <div className="prediction-title-wrapper">
                                        <h2 id="prediction-title">일 목표 달성 예측</h2>
                                        <select className="product-selector" value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}>
                                            <option value="overall">전체</option>
                                            {monthlyProductGoals.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                        </select>
                                   </div>
                                   
                                   {simulationData.remainingHours > 0 && (
                                       <div className="simulation-control">
                                           <div className="simulation-header">
                                               <span className="sim-label">What-if 시뮬레이션:</span>
                                               <span className="sim-value">시간당 {simulationAdjustment > 0 ? '+' : ''}{simulationAdjustment}건</span>
                                           </div>
                                           <input 
                                             type="range" 
                                             min="-5" 
                                             max="5" 
                                             step="1" 
                                             value={simulationAdjustment} 
                                             onChange={(e) => setSimulationAdjustment(parseInt(e.target.value))}
                                             className="simulation-slider"
                                           />
                                           <div className="sim-desc">남은 시간({simulationData.remainingHours}시간) 동안 시간당 성과 변화를 예측해보세요.</div>
                                       </div>
                                   )}

                                   <div className="kpi-grid">
                                        <div className="kpi-item prediction">
                                            <div className="value">{Math.round(simulationData.simulatedTotal).toLocaleString()}건</div>
                                            <div className="label">예상 성공 건수</div>
                                        </div>
                                        <div className="kpi-item prediction">
                                            <div className="value">{simulationData.simulatedAchievement.toFixed(1)}%</div>
                                            <div className="label">예상 달성률</div>
                                        </div>
                                     </div>
                                     
                                     <div className={`ai-guide-message ${simulationData.guideType}`}>
                                         <div className="ai-guide-icon">🤖 AI 가이드</div>
                                         {simulationData.guideMessage}
                                     </div>
                                </div>
                                <div className="card">
                                    <h2>성과 추이 차트 ({selectedTeam === 'team1' ? '1팀' : '2팀'})</h2>
                                    <PerformanceChart entries={entries} />
                                </div>
                            </div>

                            <div className="card data-table-container">
                                 <h2>시간대별 입력 데이터 ({selectedTeam === 'team1' ? '1팀' : '2팀'})</h2>
                                 <div className="data-table-wrapper">
                                     <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>시간</th>
                                                <th>인입</th>
                                                <th>메모</th>
                                                <th>확인</th>
                                                <th>STT</th>
                                                <th>총 성공</th>
                                                <th>개통</th>
                                                {monthlyProductGoals.map(p => <th key={p.id}>{p.name}</th>)}
                                                <th className="report-hidden">작업</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {entries.map(entry => (
                                                <tr key={entry.reportingTime}>
                                                    <td>{entry.reportingTime}시</td>
                                                    <td>{entry.calls.toLocaleString()}</td>
                                                    <td>{entry.memoAttempts.toLocaleString()}</td>
                                                    <td>{entry.managerAttempts.toLocaleString()}</td>
                                                    <td>{entry.sttAttempts.toLocaleString()}</td>
                                                    <td>{Object.values(entry.productSuccesses).reduce<number>((s,c) => s+Number(c), 0).toLocaleString()}</td>
                                                    <td>{entry.activations.toLocaleString()}</td>
                                                    {monthlyProductGoals.map(p => <td key={p.id}>{(entry.productSuccesses[p.name] || 0).toLocaleString()}</td>)}
                                                    <td className="actions-cell report-hidden">
                                                        <button onClick={() => handleEditEntry(entry)} className="button-small button-edit" disabled={isReadOnly} aria-label={`${entry.reportingTime}시 데이터 수정`}>수정</button>
                                                        <button onClick={() => handleDeleteEntry(entry.reportingTime)} className="button-small button-danger" disabled={isReadOnly} aria-label={`${entry.reportingTime}시 데이터 삭제`}>삭제</button>
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr style={{fontWeight: 'bold', borderTop: '2px solid var(--primary-text-color)'}}>
                                                <td>합계</td>
                                                <td>{summary.totalCalls.toLocaleString()}</td>
                                                <td>{summary.totalMemoAttempts.toLocaleString()}</td>
                                                <td>{summary.totalManagerAttempts.toLocaleString()}</td>
                                                <td>{summary.totalSttAttempts.toLocaleString()}</td>
                                                <td>{summary.totalSuccesses.toLocaleString()}</td>
                                                <td>{summary.totalActivations.toLocaleString()}</td>
                                                {monthlyProductGoals.map(p => <td key={p.id}>{(summary.productSummaries[p.name]?.totalSuccesses || 0).toLocaleString()}</td>)}
                                                <td className="report-hidden"></td>
                                            </tr>
                                        </tbody>
                                     </table>
                                 </div>
                            </div>
                             <div className="card data-input-form report-hidden">
                                <h2>데이터 입력 / 수정 ({selectedTeam === 'team1' ? '1팀' : '2팀'})</h2>
                                {isReadOnly && (<div className="read-only-notice"><strong>{displayDate}</strong> 데이터 조회 중입니다. (읽기 전용)</div>)}
                                {editingTime && !isReadOnly && (<div className="editing-notice"><strong>{editingTime}시</strong> 보고 데이터 수정 중...</div>)}
                                <form onSubmit={handleAddEntry}>
                                     <table className="data-table">
                                         <thead>
                                            <tr>
                                                <th>보고 시간<Tooltip text="성과를 보고하는 시간(11시, 14시, 16시, 18시)을 선택하세요." /></th>
                                                <th>인입 콜<Tooltip text="해당 시간까지 인입된 총 콜 수입니다." /></th>
                                                <th>메모 시도<Tooltip text="상담사가 '맞춤제안' 메모를 남긴 콜 수입니다." /></th>
                                                <th>확인 시도<Tooltip text="관리자가 고객에게 확인 전화를 시도한 건수입니다." /></th>
                                                <th>STT 시도<Tooltip text="STT(음성인식)가 '맞춤제안' 키워드를 감지한 콜 수입니다." /></th>
                                                {monthlyProductGoals.map(p => <th key={p.id}>{p.name}<Tooltip text={`'${p.name}' 상품 유치에 성공한 건수입니다.`} /></th>)}
                                                <th>개통<Tooltip text="유치 성공 건 중, 실제 개통까지 완료된 건수입니다." /></th>
                                            </tr>
                                         </thead>
                                         <tbody>
                                             <tr>
                                                <td>
                                                     <select name="reportingTime" value={newEntry.reportingTime} onChange={handleInputChange} disabled={isReadOnly || (availableReportingTimes.length === 0 && editingTime === null) } aria-label="보고 시간 선택">
                                                        {availableReportingTimes.map(t => <option key={t} value={t}>{t}시</option>)}
                                                    </select>
                                                </td>
                                                <td><input type="number" name="calls" value={newEntry.calls} onChange={handleInputChange} min="0" disabled={isReadOnly}/></td>
                                                <td><input type="number" name="memoAttempts" value={newEntry.memoAttempts} onChange={handleInputChange} min="0" disabled={isReadOnly}/></td>
                                                <td><input type="number" name="managerAttempts" value={newEntry.managerAttempts} onChange={handleInputChange} min="0" disabled={isReadOnly}/></td>
                                                <td><input type="number" name="sttAttempts" value={newEntry.sttAttempts} onChange={handleInputChange} min="0" disabled={isReadOnly}/></td>
                                                {monthlyProductGoals.map(p => (
                                                    <td key={p.id}>
                                                        <input type="number" value={newEntry.productSuccesses[p.name] || 0} onChange={(e) => handleProductSuccessChange(p.name, e.target.value)} min="0" disabled={isReadOnly} />
                                                    </td>
                                                ))}
                                                <td><input type="number" name="activations" value={newEntry.activations || ''} onChange={handleInputChange} min="0" disabled={isReadOnly}/></td>
                                             </tr>
                                         </tbody>
                                     </table>
                                     <div className="form-actions-group">
                                        <button type="submit" disabled={isReadOnly || (availableReportingTimes.length === 0 && editingTime === null)}>
                                            {isReadOnly ? '추가 불가' : (editingTime ? '데이터 수정' : '보고 실적 추가')}
                                        </button>
                                        {editingTime && !isReadOnly && (
                                            <button type="button" onClick={handleCancelEdit} className="button-secondary">
                                                수정 취소
                                            </button>
                                        )}
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                    {activeTab === 'monthly' && (
                         <div className="sheet">
                            <div className="monthly-grid">
                                <div className="card">
                                    <div className="card-title-container">
                                        <h2>상품별 월간 실적 ({selectedTeam === 'team1' ? '1팀' : '2팀'})</h2>
                                        {isMonthlyProgressOverridden && !isEditingMonthlyProgress && <span className="override-indicator" title="수동으로 입력된 데이터입니다.">수동 데이터</span>}
                                    </div>
                                    {isEditingMonthlyProgress ? (
                                        <div className="monthly-progress-edit-list">
                                            {monthlyProductGoals.map(p => {
                                                return (
                                                    <div className="monthly-progress-edit-item" key={p.id}>
                                                        <label htmlFor={`edit-progress-${p.id}`}>{p.name}</label>
                                                        <div className="input-group">
                                                            <input type="number" id={`edit-progress-${p.id}`} value={editableMonthlyProgress.products[p.name] || 0} onChange={(e) => handleEditableProgressChange(p.name, e.target.value)} min="0" />
                                                            <span> / {p.goal.toLocaleString()} 건</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        monthlyProductGoals.map(p => {
                                            const progress = monthlyProgress.products[p.name] || 0;
                                            const completion = p.goal > 0 ? (progress / p.goal) * 100 : 0;
                                            return (
                                                <div className="progress-container" key={p.id}>
                                                    <div className="progress-label">
                                                        <span>{p.name}</span>
                                                        <span>{progress.toLocaleString()} / {p.goal.toLocaleString()} 건</span>
                                                    </div>
                                                    <div className="progress-bar">
                                                        <div className="progress-bar-inner" style={{ width: `${Math.min(completion, 100)}%` }}>
                                                            {completion > 10 && `${completion.toFixed(1)}%`}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                     <div className="card-actions">
                                        {isEditingMonthlyProgress ? (
                                            <div className="button-group-spread">
                                                <button onClick={handleSaveMonthlyProgress} className="button-primary">저장</button>
                                                <button onClick={handleResetMonthlyProgress} className="button-secondary button-danger">계산값으로 복원</button>
                                                <button onClick={handleCancelEditMonthlyProgress} className="button-secondary">취소</button>
                                            </div>
                                        ) : (
                                            <button onClick={handleEditMonthlyProgress} disabled={isReadOnly}>
                                                월간 실적 수정
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="card" role="region" aria-labelledby="monthly-goals-title">
                                    <h2 id="monthly-goals-title">{new Date(displayDate.replace(/-/g, '/')).toLocaleString('ko-KR', { month: 'long' })} 핵심 목표 현황</h2>
                                    <div className="progress-container">
                                         <div className="progress-label editable-goal">
                                            <span>월간 개통 목표</span>
                                            <span>{monthlyProgress.activations.toLocaleString()}건 / {monthlyGoals.activationGoal.toLocaleString()}건</span>
                                        </div>
                                        <div className="progress-bar">
                                            <div className="progress-bar-inner" style={{ width: `${Math.min(activationGoalCompletion, 100)}%`, backgroundColor: 'var(--info-color)' }}></div>
                                        </div>
                                         <div className="pacing-info">
                                            <span>(달성률 {activationGoalCompletion.toFixed(1)}% / 목표 진도 {openingDayProgress.toFixed(1)}%)</span>
                                            <span className={`pacing-status ${activationGoalStatus.className}`}>{activationGoalStatus.message}</span>
                                        </div>
                                    </div>
                                    <div className="progress-container">
                                        <div className="progress-label editable-goal">
                                            <span>시도율 (메모 기반)</span>
                                            <span>{summary.mentionRate.toFixed(1)}% / {monthlyGoals.attemptRate}%</span>
                                        </div>
                                        <div className="progress-bar">
                                            <div className="progress-bar-inner" style={{ width: `${Math.min(attemptRateCompletion, 100)}%`, backgroundColor: 'var(--primary-color)' }}></div>
                                        </div>
                                         <div className="pacing-info">
                                            <span>(달성률 {attemptRateCompletion.toFixed(1)}% / 목표 진도 {workdayProgress.toFixed(1)}%)</span>
                                            <span className={`pacing-status ${attemptRateStatus.className}`}>{attemptRateStatus.message}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="card">
                                     <h2>입체적 시도 현황 분석</h2>
                                    <table className="comparison-table">
                                        <thead>
                                            <tr>
                                                <th>구분</th>
                                                <th>건수</th>
                                                <th>차이 (vs 메모)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td>메모 기반 시도</td>
                                                <td>{summary.totalMemoAttempts.toLocaleString()}</td>
                                                <td>-</td>
                                            </tr>
                                            <tr>
                                                <td>관리자 확인 시도</td>
                                                <td>{summary.totalManagerAttempts.toLocaleString()}</td>
                                                <td>{renderDifference(summary.totalManagerAttempts, summary.totalMemoAttempts)}</td>
                                            </tr>
                                            <tr>
                                                <td>STT 감지 시도</td>
                                                <td>{summary.totalSttAttempts.toLocaleString()}</td>
                                                <td>{renderDifference(summary.totalSttAttempts, summary.totalMemoAttempts)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                         </div>
                    )}
                    {activeTab === 'settings' && (
                        <div className="sheet">
                           <div className="settings-grid">
                                <div className="card">
                                    <h2>상품별 월간 목표 설정 ({selectedTeam === 'team1' ? '1팀' : '2팀'})</h2>
                                    <div className="product-goal-list">
                                        {monthlyProductGoals.map((p, index) => (
                                            <div className="product-goal-item" key={p.id}>
                                                <input type="text" placeholder="상품명" value={p.name} onChange={e => handleProductGoalChange(p.id, 'name', e.target.value)} disabled={isReadOnly} aria-label={`상품 ${index + 1} 이름`} />
                                                <input type="number" placeholder="월 목표" value={p.goal} onChange={e => handleProductGoalChange(p.id, 'goal', e.target.value)} min="0" disabled={isReadOnly} aria-label={`상품 ${index + 1} 목표`} />
                                                <button className="button-small button-danger" onClick={() => removeProductGoal(p.id)} disabled={isReadOnly} aria-label={`상품 ${index + 1} 삭제`}>&times;</button>
                                            </div>
                                        ))}
                                    </div>
                                    <button onClick={addProductGoal} disabled={isReadOnly} className="button-secondary" style={{marginTop: '1rem'}}>
                                        상품 추가
                                    </button>
                                </div>
                                 <div className="card">
                                    <h2>월간 핵심 목표 설정</h2>
                                    <div className="form-group">
                                        <label>월간 개통 목표 (건)</label>
                                        <input type="number" value={monthlyGoals.activationGoal} onChange={e => handleGoalChange('activationGoal', e.target.value)} disabled={isReadOnly} />
                                    </div>
                                     <div className="form-group">
                                        <label>시도율 목표 (메모, %)</label>
                                        <input type="number" value={monthlyGoals.attemptRate} onChange={e => handleGoalChange('attemptRate', e.target.value)} disabled={isReadOnly} />
                                    </div>
                                     <div className="form-group">
                                        <label>적극 시도율 목표 (확인, %)</label>
                                        <input type="number" value={monthlyGoals.activeAttemptRate} onChange={e => handleGoalChange('activeAttemptRate', e.target.value)} disabled={isReadOnly} />
                                    </div>
                                     <div className="form-group">
                                        <label>STT 언급률 목표 (%)</label>
                                        <input type="number" value={monthlyGoals.sttMentionRate} onChange={e => handleGoalChange('sttMentionRate', e.target.value)} disabled={isReadOnly} />
                                    </div>
                                </div>
                                <div className="card">
                                   <h2>예측 모델 설정 (시간 가중치)</h2>
                                    <p className="card-description">시간대별 예상 성과 기여도를 설정하여 예측 정확도를 높이세요. 최종 기여도는 100%가 되어야 합니다.</p>
                                    <WeightDistributionBar weights={predictionWeights} />
                                    <div className="weight-inputs">
                                        {REPORTING_TIMES.map(time => (
                                            <div className="form-group" key={time}>
                                                <label htmlFor={`weight-${time}`}>{time}시까지의 기여도 (%)</label>
                                                <input type="number" id={`weight-${time}`} value={predictionWeights[time] || ''} onChange={(e) => handleWeightChange(time, e.target.value)} min="0" max="100" disabled={isReadOnly} aria-label={`${time}시까지의 기여도`} />
                                            </div>
                                        ))}
                                    </div>
                                    <div className="weight-summary">
                                        <strong>최종 기여도: </strong>
                                        <strong className={finalWeight !== 100 ? 'weight-warning' : ''}>{finalWeight}%</strong>
                                    </div>
                                    {finalWeight !== 100 && <p className="weight-warning-message">최종 기여도는 100%가 되어야 합니다.</p>}
                                    <div className="restore-button-container">
                                        <button type="button" onClick={handleResetWeights} className="button-secondary" disabled={isReadOnly}>
                                            기본값으로 복원
                                        </button>
                                    </div>
                                </div>
                                <div className="card">
                                    <h2>{new Date(displayDate.replace(/-/g, '/')).toLocaleString('ko-KR', { month: 'long' })} 영업일 설정</h2>
                                    <div className="kpi-grid">
                                        <div className="kpi-item editable-kpi">
                                            <div className="label">개통 가능일</div>
                                            <div className="input-wrapper">
                                                <input type="number" id="openingDaysOverride" value={displayedMonthInfo.openingDays} onChange={(e) => handleMonthInfoChange('openingDays', e.target.value)} disabled={isReadOnly} aria-label="개통 가능일 수정" />
                                                <span className="unit">일</span>
                                            </div>
                                        </div>
                                        <div className="kpi-item editable-kpi">
                                            <div className="label">순청약 영업일</div>
                                            <div className="input-wrapper">
                                                <input type="number" id="netApplicationDaysOverride" value={displayedMonthInfo.netApplicationDays} onChange={(e) => handleMonthInfoChange('netApplicationDays', e.target.value)} disabled={isReadOnly} aria-label="순청약 영업일 수정" />
                                                <span className="unit">일</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                           </div>
                           <div className="settings-actions report-hidden">
                               <button onClick={handleSaveSettings} disabled={isReadOnly}>
                                   설정 저장
                               </button>
                           </div>
                        </div>
                    )}
                    {activeTab === 'manual' && (
                        <div className="sheet">
                            <div className="card">
                                <h2>성과 대시보드 전체 메뉴얼</h2>
                                <div className="manual-content">
                                    <ManualContent />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </>
    );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);