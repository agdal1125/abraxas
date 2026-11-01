# Abraxas 원본 캐릭터 에셋 출처 및 제작 기록 (Provenance)

## 1. 제작 도구 및 실행 환경

- **컨셉 아트 생성 도구**: Antigravity `image-generator` 서브에이전트 (실제 호출하여 6종 턴어라운드 컨셉 시트 생성)
- **에이전트 모델**: `gemini-4-argon-medium`
- **3D 모델링·베이크·리깅·내보내기 도구**: **Blender 5.2.3 LTS** (`C:/Program Files/Blender Foundation/Blender 5.2/blender.exe`, 해시 `e13b728c6880`)
- **제작 스크립트**: `assets/source/characters/build_characters.py`
- **Blender 소스 파일**: `assets/source/characters/characters.blend`
- **자체 AO 베이크 소스**: `assets/source/characters/ao_<key>.png` (Cycles 32 samples, 512×512, 여백 8px, 선형 공간에서 `COLOR_0` 버텍스 컬러에 약하게 곱한 뒤 내보내기 시 텍스처 노드를 제거해 순수 `COLOR_0` 정점 컬러로 경량화)
- **GLB 압축**: glTF 2.0 binary (`.glb`) + `KHR_draco_mesh_compression` (level 6, position 14bit, normal 10bit, color 12bit, +Y up)

---

## 2. 독자적 형태 설계 이유 및 아트 바이블 준수 사항

1. **기존 IP 모방 배제 및 원형 기하 실루엣 기반 설계**:
   - 실존 게임·애니메이션·상표·로고·기존 캐릭터나 외부 에셋(KayKit 등)을 일절 참조하거나 재사용하지 않고, 오직 **‘둥글고 따뜻한 로우폴리 디오라마’**라는 재질·조명 톤만 기준으로 삼았다.
   - 모든 캐릭터는 **성별 중립 SD 3등신** 비례(전체 키 대비 머리 약 1/3)로 통일하고, 머리카락이나 성별 고정 의상 없이 **기본 입체 도형(구·물방울·원기둥·블록·알 껍질·작은 챙 모자)**과 **역할 소품(깃발·앞치마·둥근 안경·망치)**만으로 흑백 실루엣에서도 즉시 구분되도록 설계했다.
2. **측정 오염 방지 및 중립 표현**:
   - 얼굴은 주인공(`player`, 눈·입 없음)을 제외한 5종 모두 단순한 점 눈과 작은 일자 입(`#3B2A22`)만 두어 플레이어가 특정 답변의 호불호를 표정에서 유추하지 못하게 했다.
   - `talk` 클립 역시 하트·물음표·긍정/부정 과장 연출 없이 공감과 생각에 잠김 양쪽 반응에 모두 자연스럽게 쓰이는 **중립 고개 끄덕임·기울임과 잔잔한 손짓** 한 가지 동작으로 베이크했다.
3. **치수·원점·축 계약**:
   - `1 unit = 1m`, 원점 `(0, 0, 0)`은 양발 바닥 접지면 중앙(`min Y = 0.0m`).
   - Blender 내부 작업은 `Z-up, 정면 -Y`로 제작 후 glTF 내보내기 시 `+Y up, 정면 +Z, 바닥 XZ`로 변환했다.
   - 모든 캐릭터는 8개 deform bones(`root`, `body`, `head`, `arm_l`, `arm_r`, `hand_prop`, `leg_l`, `leg_r`, 상한 16개 이하)와 정점당 최대 2개 가중치(상한 4개 이하), 단일 메시·단일 PBR 재질(`Metallic 0.0`, `Roughness 0.85`, `COLOR_0` 버텍스 컬러)로 구성했다.
   - `idle`(2.0초, 48f), `walk`(0.8초, 19f), `talk`(1.6초, 38f) 3개 클립을 24fps 제자리 루프(`root` 이동 0)로 베이크하여 NLA 트랙으로 내보냈다.

---

## 3. 캐릭터 6종 컨셉 생성 프롬프트 및 경로

`image-generator`가 아티팩트 디렉터리에 생성한 원본 이미지와 `build_characters.py`를 통해 `assets/source/concepts/characters/` 아래에 PNG(1024×1024, 상한 1536² 이하)로 저장한 사본 경로는 다음과 같다.

### 3.1 `player` (주인공 — 얼굴 없는 둥근 몸 + 반쪽 알 껍질, 키 0.58m)
- **원본 아티팩트 경로**: `C:/Users/jake1/.gemini/antigravity-cli/brain/101c2ff1-b0d8-495b-baac-4c63174efa87/character_concept_player_1793496357497.jpg`
- **컨셉 PNG 사본 경로**: `assets/source/concepts/characters/player.png`
- **독자적 형태 이유**: 기억을 잃은 주인공의 정체성과 외형 최소화 원칙을 표현하기 위해 눈·입·머리카락을 모두 비운 크림색(`#FFF8EC`) 둥근 머리와 따뜻한 베이지 몸통(`#EED6B8`) 위에 지그재그 금이 간 반쪽 알 껍질 모자(`#E9D7BB`)만 얹어 독자적인 실루엣을 만들었다.
- **프롬프트**:
  > Original 3D character design turnaround concept art sheet, showing front view and side view side-by-side on a clean solid light cream background (#FFF8EC). At the bottom of the sheet is a horizontal row of 3 circular flat color palette swatches. The aesthetic is warm low-poly diorama toy figure, soft beveled edges, smooth matte clay and painted wood texture with zero gloss or metallic sheen, soft ambient occlusion. Proportions are gender-neutral 3-head-tall super deformed (SD) figurine: round head making up 1/3 height, rounded torso, short stubby arms and little rounded feet. The character is completely faceless with a smooth blank head containing NO eyes, NO nose, and NO mouth. On top of the round head sits a cracked half-eggshell helmet cap in warm eggshell beige (#E9D7BB) with gentle zig-zag jagged rim points. Side-by-side orthographic turnaround presentation, studio model sheet, clean minimalist design, no logos, no text, no watermarks.

### 3.2 `char-a` (공략 캐릭터 A — 공형 몸통 + 깃발, `#FF7A59`, 키 0.60m)
- **원본 아티팩트 경로**: `C:/Users/jake1/.gemini/antigravity-cli/brain/101c2ff1-b0d8-495b-baac-4c63174efa87/character_concept_chara_1793496376028.jpg`
- **컨셉 PNG 사본 경로**: `assets/source/concepts/characters/char-a.png`
- **독자적 형태 이유**: 광장과 축제를 이끄는 활기찬 성향을 둥근 공형(구형) 코랄 오렌지(`#FF7A59`) 몸통과 크림색 둥근 목 둘레 링(`#FFF8EC`), 손 본(`hand_prop`)에 결합된 나무 막대(`#9B7355`) 삼각 페넌트 깃발(`#FFF8EC`)로 단순화해 원거리 쿼터뷰와 흑백 실루엣에서도 즉시 식별되게 했다.
- **프롬프트**:
  > Original 3D character design turnaround concept art sheet, showing front view and side view side-by-side on a clean solid light cream background (#FFF8EC). At the bottom of the sheet is a horizontal row of 4 circular flat color palette swatches (coral orange, cream, dark brown, wood tone). The aesthetic is warm low-poly diorama toy figure, soft beveled edges, smooth matte clay and painted wood texture with zero gloss or metallic sheen, soft ambient occlusion. Proportions are gender-neutral 3-head-tall super deformed (SD) figurine. The character has a smooth round cream-colored head (#FFF8EC) with no hair, featuring two simple minimalist dark brown dot eyes and a tiny neutral horizontal line mouth (#3B2A22). The torso is plump and spherical ball-shaped in warm coral orange (#FF7A59) with a clean subtle cream-colored collar ring trim around the neck. Short rounded arms and stubby feet. In the right hand, the figure holds a small triangular cream pennant flag attached to a short wooden stick. Side-by-side orthographic turnaround presentation, clean studio model sheet, no logos, no text, no watermarks.

### 3.3 `char-b` (공략 캐릭터 B — 물방울형 몸통 + 앞치마, `#FFB020`, 키 0.60m)
- **원본 아티팩트 경로**: `C:/Users/jake1/.gemini/antigravity-cli/brain/101c2ff1-b0d8-495b-baac-4c63174efa87/character_concept_charb_1793496394723.jpg`
- **컨셉 PNG 사본 경로**: `assets/source/concepts/characters/char-b.png`
- **독자적 형태 이유**: 따뜻하고 포근한 인상을 주기 위해 위쪽 어깨는 좁고 아래쪽 배가 볼록한 물방울형(서양배형) 호박색(`#FFB020`) 몸통을 채택하고, 전면에 둥근 크림색 앞치마와 목 끈(`#FFF8EC`)을 입체 메시로 배치해 측면·정면 모두 독자적인 곡선 윤곽을 갖도록 했다.
- **프롬프트**:
  > Original 3D character design turnaround concept art sheet, showing front view and side view side-by-side on a clean solid light cream background (#FFF8EC). At the bottom of the sheet is a horizontal row of 4 circular flat color palette swatches (golden amber, cream, dark brown, soft shadow tone). The aesthetic is warm low-poly diorama toy figure, soft beveled edges, smooth matte clay and painted wood texture with zero gloss or metallic sheen, soft ambient occlusion. Proportions are gender-neutral 3-head-tall super deformed (SD) figurine. The character has a smooth round cream-colored head (#FFF8EC) with no hair, featuring two simple minimalist dark brown dot eyes and a tiny neutral line mouth (#3B2A22). The body has a distinct pear-shaped teardrop rounded torso (narrower at the shoulders, wider rounded bottom) in warm golden amber (#FFB020). The figure wears a simple minimalist rounded cream-white baker apron (#FFF8EC) on the front of the torso. Short stubby arms and legs. Side-by-side orthographic turnaround presentation, clean studio model sheet, no logos, no text, no watermarks.

### 3.4 `char-c` (공략 캐릭터 C — 원기둥형 몸통 + 큰 머리 + 둥근 안경, `#8E6BFF`, 키 0.65m)
- **원본 아티팩트 경로**: `C:/Users/jake1/.gemini/antigravity-cli/brain/101c2ff1-b0d8-495b-baac-4c63174efa87/char_c_1793496351405.jpg`
- **컨셉 PNG 사본 경로**: `assets/source/concepts/characters/char-c.png`
- **독자적 형태 이유**: 사색적이고 차분한 인상을 수직 원기둥형 보라색(`#8E6BFF`) 몸통과 작은 크림색 목도리 탭(`#FFF8EC`), 다른 캐릭터보다 살짝 큰 머리(전체 키 0.65m) 및 굵은 둥근 안경테(`#3B2A22`)로 구성해 키와 머리 비례만으로도 실루엣이 구분되도록 했다.
- **프롬프트**:
  > Original 3D character turnaround concept art sheet showing Front View and Side View side-by-side against a clean solid light cream background (#FFF8EC). At the bottom of the sheet, include 4 clean circular or rectangular flat color palette swatches (soft violet purple, warm cream, dark brown). Style: Rounded warm low-poly 3D diorama toy figure, soft beveled edges, matte smooth clay/wood surface with zero gloss. Gender-neutral 3-head-tall super-deformed proportions (head is one third of total height, stubby limbs). Character design: Upright cylindrical pill-shaped torso in soft violet purple (#8E6BFF) with a small cream scarf collar (#FFF8EC) at the neck. Round cream head (#FFF8EC) with two simple dark brown dot eyes, tiny neutral mouth, and distinctive thick round dark brown eyeglass frames (#3B2A22). No hair, completely smooth head. Short stubby arms and legs in A-pose. Studio lighting, clean model turnaround sheet.

### 3.5 `char-d` (공략 캐릭터 D — 블록형 몸통 + 넓은 어깨 + 망치, `#14B8A6`, 키 0.60m)
- **원본 아티팩트 경로**: `C:/Users/jake1/.gemini/antigravity-cli/brain/101c2ff1-b0d8-495b-baac-4c63174efa87/char_d_1793496370897.jpg`
- **컨셉 PNG 사본 경로**: `assets/source/concepts/characters/char-d.png`
- **독자적 형태 이유**: 단단하고 묵직한 제작자 이미지를 모서리를 부드럽게 베벨한 청록색(`#14B8A6`) 블록형 몸통과 좌우로 넓은 어깨 패드, 나무색 허리 벨트(`#9B7355`), 손 본(`hand_prop`)에 결합된 돌/철 망치(`#777777` 헤드 + `#9B7355` 자루)로 표현해 각진 실루엣 대비를 분명히 했다.
- **프롬프트**:
  > Original 3D character turnaround concept art sheet showing Front View and Side View side-by-side against a clean solid light cream background (#FFF8EC). At the bottom of the sheet, include 4 flat color palette swatches (teal, wooden-brown, cream, dark gray). Style: Rounded warm low-poly 3D diorama toy figure, soft beveled edges, matte smooth clay and painted wood surface with zero gloss. Gender-neutral 3-head-tall super-deformed proportions (head is one third of total height). Character design: Sturdy beveled block-shaped torso with broad squared-off rounded shoulders in teal (#14B8A6) with a simple wooden-brown belt accent (#9B7355) around the waist. Round cream head (#FFF8EC), completely smooth and bald, with two simple dark brown dot eyes and a tiny neutral mouth (#3B2A22). Short sturdy arms and legs. The figure holds a small compact beveled rectangular stone/iron hammer (#777777 head, #9B7355 handle) in one hand. Clean studio lighting, model turnaround sheet.

### 3.6 `quest-npc` (퀘스트 NPC — 회색조 몸통 + 작은 모자, `#A0A0A0`/`#777777`, 키 0.56m)
- **원본 아티팩트 경로**: `C:/Users/jake1/.gemini/antigravity-cli/brain/101c2ff1-b0d8-495b-baac-4c63174efa87/quest_npc_1793496386962.jpg`
- **컨셉 PNG 사본 경로**: `assets/source/concepts/characters/quest-npc.png`
- **공유 ID**: `s1j2`, `s2j2`, `s3j2`, `s4j2` (4개 퀘스트 NPC ID 공유)
- **독자적 형태 이유**: 공략 캐릭터 4인의 고채도 대표색을 방해하지 않도록 중성 회색조(`#A0A0A0` 몸통, `#777777` 작은 챙 모자)와 아담한 키(0.56m)로 설계하여 마을 주민 NPC로서의 역할을 명확히 구분했다.
- **프롬프트**:
  > Original 3D character turnaround concept art sheet showing Front View and Side View side-by-side against a clean solid light cream background (#FFF8EC). At the bottom of the sheet, include flat color palette swatches (warm medium gray, dark gray cap color, cream, dark brown). Style: Rounded warm low-poly 3D diorama toy figure, soft beveled edges, matte smooth clay and painted wood surface with zero gloss. Gender-neutral 3-head-tall super-deformed proportions (head is one third of total height, short stubby cylindrical limbs). Character design: Compact rounded oval torso in warm medium gray (#A0A0A0). Round cream head (#FFF8EC) with two simple dark brown dot eyes and a tiny neutral mouth (#3B2A22). No hair. Wearing a small rounded dark gray brimmed cap (#777777) perched neatly on top of the head. Short stubby arms and legs in neutral pose. Clean studio lighting, model turnaround sheet.
