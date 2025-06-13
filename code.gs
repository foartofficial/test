// 스프레드시트 ID 설정
const SPREADSHEET_ID = '1brh67aJrXMq1SEw9CydIBfl-Xi_W1Nfa5iXacK0A-xw';

// 스프레드시트 가져오기 함수
function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

// 스프레드시트 초기화
function initializeSpreadsheet() {
  const ss = getSpreadsheet();
  
  // 시트 생성 및 헤더 설정
  createSheetWithHeaders('Members', [
    '회원ID', '이름', '전화번호', '등록일', '메모', '상태'
  ]);
  
  createSheetWithHeaders('Passes', [
    '이용권ID', '회원ID', '이용권종류', '구매일', '총횟수', '사용횟수', '잔여횟수', '만료일', '상태'
  ]);
  
  createSheetWithHeaders('Usage', [
    '기록ID', '회원ID', '이용권ID', '이용일시', '메모'
  ]);
  
  createSheetWithHeaders('PassTypes', [
    '종류명', '가격', '총횟수', '유효기간(일)'
  ]);
  
  // 기본 이용권 종류 데이터 입력
  initializePassTypes();
}

function createSheetWithHeaders(name, headers) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(name);
  
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
}

function initializePassTypes() {
  const sheet = getSpreadsheet().getSheetByName('PassTypes');
  
  if (sheet.getLastRow() <= 1) {
    const passTypes = [
      ['1회권', 15000, 1, 30],
      ['10회권', 120000, 10, 90],
      ['월회원', 200000, 999, 30]
    ];
    
    sheet.getRange(2, 1, passTypes.length, 4).setValues(passTypes);
  }
}

// 웹앱 메인 함수
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// 회원 관련 함수들
function registerMember(memberData) {
  try {
    const ss = getSpreadsheet();
    const memberSheet = ss.getSheetByName('Members');
    
    // 회원ID 생성
    const memberId = 'M' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMddHHmmss');
    
    // 회원 등록
    const memberRow = [
      memberId,
      memberData.name,
      memberData.phone,
      Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'),
      memberData.memo || '',
      '활성'
    ];
    
    memberSheet.appendRow(memberRow);
    
    // 이용권 구매 (선택사항)
    if (memberData.passType) {
      const passData = {
        memberId: memberId,
        passType: memberData.passType
      };
      purchasePass(passData);
    }
    
    return { success: true, memberId: memberId };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function purchasePass(passData) {
  try {
    const ss = getSpreadsheet();
    const passSheet = ss.getSheetByName('Passes');
    const passTypesSheet = ss.getSheetByName('PassTypes');
    
    // 이용권 종류 정보 조회
    const passTypes = passTypesSheet.getDataRange().getValues();
    const passType = passTypes.find(row => row[0] === passData.passType);
    
    if (!passType) {
      throw new Error('이용권 종류를 찾을 수 없습니다.');
    }
    
    // 이용권ID 생성
    const passId = 'P' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMddHHmmss');
    
    // 만료일 계산
    const purchaseDate = new Date();
    const expiryDate = new Date(purchaseDate.getTime() + (passType[3] * 24 * 60 * 60 * 1000));
    
    const passRow = [
      passId,
      passData.memberId,
      passData.passType,
      Utilities.formatDate(purchaseDate, 'Asia/Seoul', 'yyyy-MM-dd'),
      passType[2], // 총횟수
      0, // 사용횟수
      passType[2], // 잔여횟수
      Utilities.formatDate(expiryDate, 'Asia/Seoul', 'yyyy-MM-dd'),
      '사용중'
    ];
    
    passSheet.appendRow(passRow);
    
    return { success: true, passId: passId };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function searchMembers(keyword) {
  console.log("🔥 searchMembers() 호출됨, keyword:", keyword);
  try {
    if (!keyword || typeof keyword !== 'string') {
      console.log("❌ 유효하지 않은 검색어:", keyword);
      return { success: false, error: '검색어가 유효하지 않습니다.' };
    }

    const ss = getSpreadsheet();
    const memberSheet = ss.getSheetByName('Members');
    const passSheet = ss.getSheetByName('Passes');

    const memberData = memberSheet.getDataRange().getValues();
    const passData = passSheet.getDataRange().getValues();

    console.log("✅ Members 시트 로딩 완료, 행 수:", memberData.length);
    console.log("✅ Passes 시트 로딩 완료, 행 수:", passData.length);

    const results = [];
    const keywordLower = keyword.toLowerCase().trim().replace(/-/g, '');

    for (let i = 1; i < memberData.length; i++) {
      const member = memberData[i];
      const name = member[1]?.toString().toLowerCase();
      const phone = member[2]?.toString().replace(/-/g, '').toLowerCase();

      if (
        (name && name.includes(keywordLower)) ||
        (phone && phone.includes(keywordLower))
      ) {
        // activePasses를 안전하게 필터링
        const activePasses = passData.filter(pass => {
          try {
            return (
              pass[1] === member[0] &&
              pass[8] === '사용중' &&
              !isNaN(Number(pass[6])) &&
              Number(pass[6]) > 0
            );
          } catch (e) {
            console.warn('⚠️ pass row 처리 중 오류:', pass);
            return false;
          }
        });

        results.push({
          memberId: member[0],
          name: member[1],
          phone: member[2],
          registerDate: member[3],
          memo: member[4],
          status: member[5],
          activePasses: activePasses.map(pass => ({
            passId: pass[0],
            passType: pass[2],
            remainingCount: pass[6],
            expiryDate: pass[7]
          }))
        });
      }
    }

    console.log("🔍 검색 결과 수:", results.length);
    return { success: true, results: results };

  } catch (error) {
    console.error("💥 searchMembers 예외 발생:", error.toString());
    return { success: false, error: error.toString() };
  }
}


function usePass(passId) {
  try {
    const ss = getSpreadsheet();
    const passSheet = ss.getSheetByName('Passes');
    const usageSheet = ss.getSheetByName('Usage');
    
    const passData = passSheet.getDataRange().getValues();
    
    // 이용권 찾기
    for (let i = 1; i < passData.length; i++) {
      if (passData[i][0] === passId) {
        const currentUsed = passData[i][5];
        const remaining = passData[i][6];
        
        if (remaining <= 0) {
          throw new Error('잔여 횟수가 없습니다.');
        }
        
        // 사용횟수 증가, 잔여횟수 감소
        passSheet.getRange(i + 1, 6).setValue(currentUsed + 1);
        passSheet.getRange(i + 1, 7).setValue(remaining - 1);
        
        // 잔여횟수가 0이 되면 상태 변경
        if (remaining - 1 <= 0) {
          passSheet.getRange(i + 1, 9).setValue('만료');
        }
        
        // 이용기록 추가
        const usageId = 'U' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMddHHmmss');
        const usageRow = [
          usageId,
          passData[i][1], // 회원ID
          passId,
          Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'),
          '이용권 사용'
        ];
        
        usageSheet.appendRow(usageRow);
        
        return { success: true, remaining: remaining - 1 };
      }
    }
    
    throw new Error('이용권을 찾을 수 없습니다.');
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function getPassTypes() {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('PassTypes');
    const data = sheet.getDataRange().getValues();
    
    const passTypes = [];
    for (let i = 1; i < data.length; i++) {
      passTypes.push({
        name: data[i][0],
        price: data[i][1],
        totalCount: data[i][2],
        validDays: data[i][3]
      });
    }
    
    return { success: true, passTypes: passTypes };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function getStatistics() {
  try {
    const ss = getSpreadsheet();
    const memberSheet = ss.getSheetByName('Members');
    const usageSheet = ss.getSheetByName('Usage');
    
    const memberData = memberSheet.getDataRange().getValues();
    const usageData = usageSheet.getDataRange().getValues();
    
    const today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
    
    // 총 회원수 (활성 회원만)
    const totalMembers = memberData.slice(1).filter(row => row[5] === '활성').length;
    
    // 오늘 이용자 수
    const todayUsers = usageData.filter(row => {
      if (row[3] && row[3].toString().includes(today)) {
        return true;
      }
      return false;
    }).length;
    
    return {
      success: true,
      statistics: {
        totalMembers: totalMembers,
        todayUsers: todayUsers
      }
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}