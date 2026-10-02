$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$targetDocx = "c:\Users\acer\Downloads\dgcweb--main\Dire_Dawa_Survey_Responses_10.docx"
$targetDoc = "c:\Users\acer\Downloads\dgcweb--main\Dire_Dawa_Survey_Responses_10.doc"

$buildDir = Join-Path $env:TEMP ("docx_full_" + [Guid]::NewGuid().ToString("N"))
if (Test-Path $buildDir) { Remove-Item -Recurse -Force $buildDir }
$null = New-Item -ItemType Directory -Path (Join-Path $buildDir "_rels")
$null = New-Item -ItemType Directory -Path (Join-Path $buildDir "word\_rels")

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# 1. [Content_Types].xml
$ctXml = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>
'@
[System.IO.File]::WriteAllText((Join-Path $buildDir "[Content_Types].xml"), $ctXml, $utf8NoBom)

# 2. _rels/.rels
$relsXml = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
'@
[System.IO.File]::WriteAllText((Join-Path $buildDir "_rels\.rels"), $relsXml, $utf8NoBom)

# 3. word/_rels/document.xml.rels
$docRelsXml = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
'@
[System.IO.File]::WriteAllText((Join-Path $buildDir "word\_rels\document.xml.rels"), $docRelsXml, $utf8NoBom)

# 4. word/styles.xml
$stylesXml = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Segoe UI" w:hAnsi="Segoe UI" w:eastAsia="Segoe UI" w:cs="Nyala"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
        <w:color w:val="2D3748"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
</w:styles>
'@
[System.IO.File]::WriteAllText((Join-Path $buildDir "word\styles.xml"), $stylesXml, $utf8NoBom)

# 5. Build word/document.xml
function Escape-Xml([string]$str) {
  if (-not $str) { return "" }
  return [System.Security.SecurityElement]::Escape($str)
}

function Para-Heading1([string]$text) {
  $esc = Escape-Xml $text
  return "<w:p><w:pPr><w:jc w:val=""center""/><w:spacing w:before=""160"" w:after=""80""/></w:pPr><w:r><w:rPr><w:rFonts w:ascii=""Segoe UI"" w:hAnsi=""Segoe UI"" w:cs=""Nyala""/><w:b/><w:sz w:val=""32""/><w:szCs w:val=""32""/><w:color w:val=""1A365D""/></w:rPr><w:t xml:space=""preserve"">$esc</w:t></w:r></w:p>"
}

function Para-Subtitle([string]$text) {
  $esc = Escape-Xml $text
  return "<w:p><w:pPr><w:jc w:val=""center""/><w:spacing w:after=""60""/></w:pPr><w:r><w:rPr><w:rFonts w:ascii=""Segoe UI"" w:hAnsi=""Segoe UI"" w:cs=""Nyala""/><w:sz w:val=""22""/><w:szCs w:val=""22""/><w:color w:val=""4A5568""/></w:rPr><w:t xml:space=""preserve"">$esc</w:t></w:r></w:p>"
}

function Para-MetaBadge([string]$text) {
  $esc = Escape-Xml $text
  return "<w:p><w:pPr><w:jc w:val=""center""/><w:spacing w:after=""200""/><w:pBdr><w:bottom w:val=""single"" w:sz=""12"" w:space=""6"" w:color=""2B6CB0""/></w:pBdr></w:pPr><w:r><w:rPr><w:rFonts w:ascii=""Segoe UI"" w:hAnsi=""Segoe UI"" w:cs=""Nyala""/><w:b/><w:sz w:val=""20""/><w:szCs w:val=""20""/><w:color w:val=""2B6CB0""/></w:rPr><w:t xml:space=""preserve"">$esc</w:t></w:r></w:p>"
}

function Para-SectionTitle([string]$text) {
  $esc = Escape-Xml $text
  return "<w:p><w:pPr><w:spacing w:before=""240"" w:after=""120""/></w:pPr><w:r><w:rPr><w:rFonts w:ascii=""Segoe UI"" w:hAnsi=""Segoe UI"" w:cs=""Nyala""/><w:b/><w:sz w:val=""26""/><w:szCs w:val=""26""/><w:color w:val=""1A365D""/></w:rPr><w:t xml:space=""preserve"">$esc</w:t></w:r></w:p>"
}

function Para-Text([string]$text) {
  $esc = Escape-Xml $text
  return "<w:p><w:pPr><w:spacing w:after=""140""/></w:pPr><w:r><w:rPr><w:rFonts w:ascii=""Segoe UI"" w:hAnsi=""Segoe UI"" w:cs=""Nyala""/><w:sz w:val=""22""/><w:szCs w:val=""22""/><w:color w:val=""2D3748""/></w:rPr><w:t xml:space=""preserve"">$esc</w:t></w:r></w:p>"
}

function Para-CardHeader([string]$title, [string]$meta, [string]$color="1A365D") {
  $escTitle = Escape-Xml $title
  $escMeta = Escape-Xml $meta
  return @"
  <w:p>
    <w:pPr>
      <w:spacing w:before="240" w:after="40"/>
      <w:pBdr><w:left w:val="single" w:sz="24" w:space="8" w:color="$color"/></w:pBdr>
      <w:shd w:val="clear" w:color="auto" w:fill="EDF2F7"/>
    </w:pPr>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Segoe UI" w:hAnsi="Segoe UI" w:cs="Nyala"/><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/><w:color w:val="$color"/></w:rPr>
      <w:t xml:space="preserve">  $escTitle</w:t>
    </w:r>
  </w:p>
  <w:p>
    <w:pPr>
      <w:spacing w:after="120"/>
      <w:pBdr><w:left w:val="single" w:sz="24" w:space="8" w:color="$color"/></w:pBdr>
      <w:shd w:val="clear" w:color="auto" w:fill="EDF2F7"/>
    </w:pPr>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Segoe UI" w:hAnsi="Segoe UI" w:cs="Nyala"/><w:sz w:val="19"/><w:szCs w:val="19"/><w:color w:val="718096"/></w:rPr>
      <w:t xml:space="preserve">  $escMeta</w:t>
    </w:r>
  </w:p>
"@
}

function Para-QA([string]$qNum, [string]$qText, [string]$answer, [string]$badgeColor="2B6CB0") {
  $escQ = Escape-Xml ("$qNum: $qText")
  $escA = Escape-Xml $answer
  return @"
  <w:p>
    <w:pPr>
      <w:spacing w:before="100" w:after="40"/>
    </w:pPr>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Segoe UI" w:hAnsi="Segoe UI" w:cs="Nyala"/><w:b/><w:sz w:val="21"/><w:szCs w:val="21"/><w:color w:val="1A365D"/></w:rPr>
      <w:t xml:space="preserve">$escQ</w:t>
    </w:r>
  </w:p>
  <w:p>
    <w:pPr>
      <w:ind w:left="280"/>
      <w:spacing w:after="120"/>
      <w:pBdr><w:left w:val="single" w:sz="16" w:space="6" w:color="$badgeColor"/></w:pBdr>
      <w:shd w:val="clear" w:color="auto" w:fill="F7FAFC"/>
    </w:pPr>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Segoe UI" w:hAnsi="Segoe UI" w:cs="Nyala"/><w:i/><w:sz w:val="21"/><w:szCs w:val="21"/><w:color w:val="2D3748"/></w:rPr>
      <w:t xml:space="preserve">ምላሽ: $escA</w:t>
    </w:r>
  </w:p>
"@
}

function TableCell([string]$text, [int]$w=2000, [bool]$isH=$false, [string]$bg="") {
  $esc = Escape-Xml $text
  $bTag = if ($isH) { '<w:b/>' } else { '' }
  $color = if ($isH) { 'FFFFFF' } else { '2D3748' }
  $sz = if ($isH) { 20 } else { 19 }
  $shdTag = if ($bg) { "<w:shd w:val=""clear"" w:color=""auto"" w:fill=""$bg""/>" } else { "" }
  return @"
  <w:tc>
    <w:tcPr>
      <w:tcW w:w="$w" w:type="dxa"/>
      $shdTag
      <w:tcMar><w:top w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar>
    </w:tcPr>
    <w:p>
      <w:pPr><w:spacing w:before="30" w:after="30"/></w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Segoe UI" w:hAnsi="Segoe UI" w:cs="Nyala"/>$bTag<w:color w:val="$color"/><w:sz w:val="$sz"/><w:szCs w:val="$sz"/></w:rPr>
        <w:t xml:space="preserve">$esc</w:t>
      </w:r>
    </w:p>
  </w:tc>
"@
}

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>')
[void]$sb.AppendLine('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">')
[void]$sb.AppendLine('<w:body>')

# Header
[void]$sb.AppendLine((Para-Heading1 "የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ"))
[void]$sb.AppendLine((Para-Subtitle "Dire Dawa Administration Government Communication Affairs Office"))
[void]$sb.AppendLine((Para-Subtitle "የህዝብ አስተያየት ዳሰሳ መረጃዎች (Official Public Survey Responses)"))
[void]$sb.AppendLine((Para-MetaBadge "ቋንቋዎች: አማርኛ | Afaan Oromoo | Af-Soomaali • ጠቅላላ ተሳታፊዎች: 10 • መስከረም 2019 ዓ.ም (October 2026)"))

# Section 1
[void]$sb.AppendLine((Para-SectionTitle "1. አጠቃላይ ማጠቃለያ እና የተሳታፊዎች ስነ-ህዝብ (Demographics Summary)"))
[void]$sb.AppendLine((Para-Text "ይህ ሰነድ በድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ የአስተያየት መሰብሰቢያ ፕላትፎርም ላይ የተመዘገቡ 10 እውነተኛ ናሙና ምላሾችን በዝርዝር የያዘ ነው። መረጃዎቹ የድሬዳዋ ከተማን ህብረተሰብ ሁለንተናዊ ስብጥር በሚያሳይ መልኩ በሦስቱም ዋና ቋንቋዎች (አማርኛ፣ አፋን ኦሮሞ፣ ሶማሊኛ) የተካተቱ ሲሆን፣ ከተለያዩ ቀበሌዎች፣ የዕድሜ ክልሎች እና የትምህርት ደረጃዎች ተሰብስበዋል።"))

# Table
[void]$sb.AppendLine(@"
<w:tbl>
  <w:tblPr>
    <w:tblW w:w="9360" w:type="dxa"/>
    <w:tblBorders>
      <w:top w:val="single" w:sz="6" w:color="CBD5E0"/>
      <w:left w:val="single" w:sz="6" w:color="CBD5E0"/>
      <w:bottom w:val="single" w:sz="6" w:color="CBD5E0"/>
      <w:right w:val="single" w:sz="6" w:color="CBD5E0"/>
      <w:insideH w:val="single" w:sz="4" w:color="E2E8F0"/>
      <w:insideV w:val="single" w:sz="4" w:color="E2E8F0"/>
    </w:tblBorders>
  </w:tblPr>
  <w:tr>
    $(TableCell "#" 600 $true "1A365D")
    $(TableCell "ሰርቪ (Survey)" 2200 $true "1A365D")
    $(TableCell "ቋንቋ" 1300 $true "1A365D")
    $(TableCell "ዕድሜ" 1000 $true "1A365D")
    $(TableCell "ፆታ" 900 $true "1A365D")
    $(TableCell "ትምህርት" 1360 $true "1A365D")
    $(TableCell "የመኖሪያ አካባቢ" 2000 $true "1A365D")
  </w:tr>
  <w:tr>
    $(TableCell "1" 600 $false "F7FAFC")
    $(TableCell "ሰርቪ 1 (የመንግስት ምስረታ)" 2200 $false "F7FAFC")
    $(TableCell "አማርኛ" 1300 $false "F7FAFC")
    $(TableCell "26-35" 1000 $false "F7FAFC")
    $(TableCell "ወንድ" 900 $false "F7FAFC")
    $(TableCell "ዲግሪ" 1360 $false "F7FAFC")
    $(TableCell "ሳቢ" 2000 $false "F7FAFC")
  </w:tr>
  <w:tr>
    $(TableCell "2" 600 $false)
    $(TableCell "ሰርቪ 1 (የመንግስት ምስረታ)" 2200 $false)
    $(TableCell "Afaan Oromoo" 1300 $false)
    $(TableCell "36-45" 1000 $false)
    $(TableCell "ሴት" 900 $false)
    $(TableCell "ማስተርስ" 1360 $false)
    $(TableCell "ካቶ ሜሳ" 2000 $false)
  </w:tr>
  <w:tr>
    $(TableCell "3" 600 $false "F7FAFC")
    $(TableCell "ሰርቪ 1 (የመንግስት ምስረታ)" 2200 $false "F7FAFC")
    $(TableCell "Af-Soomaali" 1300 $false "F7FAFC")
    $(TableCell "18-25" 1000 $false "F7FAFC")
    $(TableCell "ወንድ" 900 $false "F7FAFC")
    $(TableCell "ዲፕሎማ" 1360 $false "F7FAFC")
    $(TableCell "ሜጋላ" 2000 $false "F7FAFC")
  </w:tr>
  <w:tr>
    $(TableCell "4" 600 $false)
    $(TableCell "ሰርቪ 2 (ፓርላማና ኢኮኖሚ)" 2200 $false)
    $(TableCell "አማርኛ" 1300 $false)
    $(TableCell "46-55" 1000 $false)
    $(TableCell "ሴት" 900 $false)
    $(TableCell "ዲግሪ" 1360 $false)
    $(TableCell "ገንዴ ቆሬ" 2000 $false)
  </w:tr>
  <w:tr>
    $(TableCell "5" 600 $false "F7FAFC")
    $(TableCell "ሰርቪ 2 (ፓርላማና ኢኮኖሚ)" 2200 $false "F7FAFC")
    $(TableCell "Afaan Oromoo" 1300 $false "F7FAFC")
    $(TableCell "26-35" 1000 $false "F7FAFC")
    $(TableCell "ወንድ" 900 $false "F7FAFC")
    $(TableCell "ሁለተኛ ደረጃ" 1360 $false "F7FAFC")
    $(TableCell "ቡሌ" 2000 $false "F7FAFC")
  </w:tr>
  <w:tr>
    $(TableCell "6" 600 $false)
    $(TableCell "ሰርቪ 3 (መሠረተ ልማት)" 2200 $false)
    $(TableCell "Afaan Oromoo" 1300 $false)
    $(TableCell "18-25" 1000 $false)
    $(TableCell "ሴት" 900 $false)
    $(TableCell "ዲፕሎማ" 1360 $false)
    $(TableCell "ለጌሃሬ" 2000 $false)
  </w:tr>
  <w:tr>
    $(TableCell "7" 600 $false "F7FAFC")
    $(TableCell "ሰርቪ 3 (መሠረተ ልማት)" 2200 $false "F7FAFC")
    $(TableCell "አማርኛ" 1300 $false "F7FAFC")
    $(TableCell "36-45" 1000 $false "F7FAFC")
    $(TableCell "ወንድ" 900 $false "F7FAFC")
    $(TableCell "ዲግሪ" 1360 $false "F7FAFC")
    $(TableCell "ድሬ ዳዋ ማዕከል" 2000 $false "F7FAFC")
  </w:tr>
  <w:tr>
    $(TableCell "8" 600 $false)
    $(TableCell "ሰርቪ 4 (ትምህርትና ጤና)" 2200 $false)
    $(TableCell "Af-Soomaali" 1300 $false)
    $(TableCell "26-35" 1000 $false)
    $(TableCell "ሴት" 900 $false)
    $(TableCell "ማስተርስ" 1360 $false)
    $(TableCell "አዲስ ቀጠና" 2000 $false)
  </w:tr>
  <w:tr>
    $(TableCell "9" 600 $false "F7FAFC")
    $(TableCell "ሰርቪ 5 (ስማርት ሲቲ)" 2200 $false "F7FAFC")
    $(TableCell "Afaan Oromoo" 1300 $false "F7FAFC")
    $(TableCell "18-25" 1000 $false "F7FAFC")
    $(TableCell "ወንድ" 900 $false "F7FAFC")
    $(TableCell "ዲፕሎማ" 1360 $false "F7FAFC")
    $(TableCell "መልካ ጀብዱ" 2000 $false "F7FAFC")
  </w:tr>
  <w:tr>
    $(TableCell "10" 600 $false)
    $(TableCell "ሰርቪ 5 (ስማርት ሲቲ)" 2200 $false)
    $(TableCell "አማርኛ" 1300 $false)
    $(TableCell "46-55" 1000 $false)
    $(TableCell "ሴት" 900 $false)
    $(TableCell "ዲግሪ" 1360 $false)
    $(TableCell "ገንዴ ቆሬ" 2000 $false)
  </w:tr>
</w:tbl>
"@)

# Section 2
[void]$sb.AppendLine((Para-SectionTitle "2. ዝርዝር የምላሾች መረጃ (Detailed Participant Submissions)"))

# Participant 1
[void]$sb.AppendLine((Para-CardHeader "ተሳታፊ 01 — ሰርቪ 1: የአስተዳደሩ አዲሱን መንግስት ምስረታ አስመልክቶ የቀረበ ዳሰሳ" "ቋንቋ: አማርኛ | ፆታ: ወንድ | ዕድሜ: 26-35 | ትምህርት: ዲግሪ | መኖሪያ: ሳቢ" "1A365D"))
[void]$sb.AppendLine((Para-QA "ጥያቄ 1" "በፌደራል ደረጃ ከሚመሰረተው መንግስት የሚጠብቁዋቸውን ተስፋዎችና አበይት ተግባራት በተመለከተ ያሎትን ሃሳብ ቢያካፍሉን?" "አዲሱ መንግስት ኢኮኖሚ ማሻሻያ፣ ሰላምና ፀጥታ ማጠናከሪያ እና ዴሞክራሲያዊ ሂደቱን ቀጣይነት ባለው መልኩ ማስቀጠል ላይ ትኩረት ሊሰጥ ይገባል። ሁሉም ዜጎች እኩል ዕድል የሚያገኙበት ፖሊሲ ቢዘረጋ ትልቅ ለውጥ ያስከትላል።" "2B6CB0"))
[void]$sb.AppendLine((Para-QA "ጥያቄ 2" "ከዚሁ የመንግስት ምስረታ ጋር ተያይዞ የህዝቡስ ድርሻ ምን መሆን ይገባል ብለው ያስባሉ?" "ህዝቡ ምርጫን ከድምጽ ሰጪነት አልፎ በፖሊሲ አዘገጃጀትና ትግበራ ላይ ቀጥተኛ ተሳትፎ ሊኖረው ይገባል። በቀበሌ ደረጃ ታዳሚ ስብሰባዎች ቢበዙ ህዝቡ ፍቃደኛ ይሆናል።" "2B6CB0"))
[void]$sb.AppendLine((Para-QA "ጥያቄ 3" "አሁን ወደ ስልጣን እንዲመጡ የተደረጉ አመራሮች አስመልክቶ ያሎት ሃሳብና አስተያየት ቢገልጹልን?" "አዲሶቹ አመራሮች ልምድና ብቃት ያላቸው ናቸው ብዬ አምናለሁ። ሆኖም ውጤቱ ከጊዜ ሂደት ጋር ሊታይ ይገባዋል። ለወጣቱ ትውልድ ዕድሎችን ቢፈጥሩ ወሳኝ ነው።" "2B6CB0"))
[void]$sb.AppendLine((Para-QA "ጥያቄ 4" "አዲሱ አመራር በድሬደዋ የተጀመሩ የሰላምና የልማት እንቅስቃሴዎችን በላቀ ደረጃ በማስቀጠል ረገድ ምን ማድረግ ይገባዋል?" "ወጣቶችን ማሳተፍ፣ ሙስናን ወደ ዜሮ ዝቅ ማድረግ እና ኢንቨስትመንትን ለመሳብ ምቹ ሁኔታ መፍጠር ቅድሚያ ሊሰጣቸው ይገባሉ።" "2B6CB0"))
[void]$sb.AppendLine((Para-QA "ጥያቄ 5" "የድሬደዋን ሁለንተናዊ ብልጽግና ለማረጋገጥ ከማን ምን ይጠበቃል?" "ዜጎች ግብር ሰጥተው ህጉን ማክበር አለባቸው። ምክር ቤቱ ለህዝብ ጥቅም ሊሰራ ይገባዋል። ነፃ ሚዲያ ለዴሞክራሲ ጤናማነት ወሳኝ ነው።" "2B6CB0"))
[void]$sb.AppendLine((Para-QA "ጥያቄ 6" "በቀጣዮቹ አመታት በድሬደዋ ሊከናወኑ ይገባቸዋል የሚሏቸው ጉዳዮች?" "ትምህርት ቤቶቹ ይሻሻሉ፣ ጤና ጣቢያዎቹ ዘመናዊ ቁሳቁስ ይኑራቸው፣ የከተማ መንገዶቹም ሊጠናቀቁ ይገባሉ።" "2B6CB0"))

# Participant 2
[void]$sb.AppendLine((Para-CardHeader "Hirmaataa 02 — Qorannoo 1: Hundeeffama Mootummaa Haaraa Dirree Dawaa" "Afaan: Afaan Oromoo | Saala: Dubara (ሴት) | Umrii: 36-45 | Barnoota: Maastarsii | Bakka: Kaatoo Meesaa" "276749"))
[void]$sb.AppendLine((Para-QA "Gaaffii 1" "Mootummaa sadarkaa federaalaatti hundeeffamu irraa abdiilee fi hojiiwwan ijoo eegdan?" "Mootummaan haaraan gamtaa lammiilee cimsuu, dinagdee fooyyessuu fi nageenyaa mirkaneessuu irratti xiyyeeffachuu qaba. Hojii misooma qonnaa fi industirii babal'isuun barbaachisaadha." "276749"))
[void]$sb.AppendLine((Para-QA "Gaaffii 2" "Hundeeffama mootummaa kanaan walqabatee gaheen uummataa maal ta'uu qaba?" "Hirmaannaan uummataa filannoo qofa otoo hintaane murtii aangoo irrattis ta'uu qaba. Yaa'ii uummataa baay'isuun murteessaadha, namoonni fedhii qaban dubbachuu dandaa'u." "276749"))
[void]$sb.AppendLine((Para-QA "Gaaffii 3" "Hoogganoota amma gara aangootti dhufan ilaalchisee yaada qabdan?" "Hooggantoonni haaraan muuxannoo fi dandeettii qabu jedheen amana. Garuu bu'aan hojii isaanii yeroo dhufutti ni mul'ata. Dargaggoota dabalachuun barbaachisaadha." "276749"))
[void]$sb.AppendLine((Para-QA "Gaaffii 4" "Hooggansi haaraan socho'iinsa nagaa fi misoomaa itti fufsiisuu keessatti maal gochuu qaba?" "Dargaggoota hojii kennuu, malaammaltummaa dhabamsiisuufi maallaqni biyya alaatii akka dhufu gochuu dursa kennuuf barbaachiisa. Barnootaa fi fayyaa irrattis hojjechuun murteessaadha." "276749"))
[void]$sb.AppendLine((Para-QA "Gaaffii 5" "Fuulduratti badhaadhina Dirree Dawaa mirkaneessuuf eenyu irraa maal eegama?" "Lammiileen gibira kaffaluufi seeraan jiraachuun dirqama. Manni maree ni deeggarama. Miidiyaan bilisaa ta'uu qaba, uummatnis odeeffannoo argachuu dandaa'u." "276749"))
[void]$sb.AppendLine((Para-QA "Gaaffii 6" "Waggoota dhufan keessatti dhimmoota raawwatamuu qaban?" "Mana barumsaa fooyyessuu, hospitaala meeshaa ammayyaa godhuu fi daandii yeroo roobaa cufamu hin qabnetti ijaaruu barbaachisa. Industirii xiqqaas deeggaruun barbaachisaadha." "276749"))

# Participant 3
[void]$sb.AppendLine((Para-CardHeader "Ka-qaybgale 03 — Xog-ururin 1: Dhismaha Dawladda Cusub Ee Maamulka Diridhaba" "Luqadda: Af-Soomaali | Lab/Dhedig: Lab (ወንድ) | Da'da: 18-25 | Waxbarasho: Diblooma | Goobta: Meegaala" "C53030"))
[void]$sb.AppendLine((Para-QA "Su'aasha 1" "Maxay yihiin rajada iyo howlaha ugu waaweyn ee aad ka filaysaan dawladda heer federaal?" "Dawladda cusuba waa inay diiradda saartaa horumarinta dhaqaalaha, xoojinta nabadda ammaanka iyo sii wadista nidaamka dimuqraadiyadda. Waxaan jeclaan lahaa in la abuuro fursad siman dhammaan shacabka." "C53030"))
[void]$sb.AppendLine((Para-QA "Su'aasha 2" "Doorka shacabku maxuu noqon karaa?" "Ka qaybgalka shacabku waa inuu ka badan yahay codeynta kaliya. Waa inay ka qaybgalaan siyaasadaha iyo hirgelinta. Shirarka dadweynaha waa in la badiyaa si fikradaha la wadaago." "C53030"))
[void]$sb.AppendLine((Para-QA "Su'aasha 3" "Fikraddaada ku aaddan hoggaamiyeyaasha cusub ee xilka qabtay?" "Hoggaamiyeyaasha cusub waxaan aaminanahay in ay leeyihiin khibrad iyo xirfad. Laakiin natiijahooda waxaa la arki doonaa marka wakhtigu dhaafay. Dhalinyarada fursad siinta muhiim." "C53030"))
[void]$sb.AppendLine((Para-QA "Su'aasha 4" "Hoggaanka cusubi maxay kula tahay inay sameeyaan nabadda iyo horumarka?" "Shababka shaqooyinka siinta, musuqmaasuqa xidid ka goynta iyo maalgashiga dibadda jiidashada waa ay muhiim u tahay. Waxaana sidoo kale la xoojin lahaa waxbarashada iyo caafimaadka." "C53030"))
[void]$sb.AppendLine((Para-QA "Su'aasha 5" "Barwaaqada guud ee Diridhaba maxaa laga filayaa cid kasta?" "Shacabku waa inay canshuuraha bixiyaan oo shareecada raacaan. Golaha waa la taageero. Warbaahinta xor ha noqoto si macluumaadka loo gaarsiiyo dadweynaha." "C53030"))
[void]$sb.AppendLine((Para-QA "Su'aasha 6" "Sannadaha soo socda arrimaha ay tahay in lagu qabto Diridhaba?" "Waxaan u baahanahay dugsiyada la horumarinta, isbitaalada alaabada casriga ah leh iyo wadooyinka roobka la go'aa dib loo dhiso. Xarumaha ganacsiga yar-yar sidoo kale la taageero." "C53030"))

# Participant 4
[void]$sb.AppendLine((Para-CardHeader "ተሳታፊ 04 — ሰርቪ 2: የፓርላማና የኢኮኖሚ አፈጻጸም የሕዝብ አስተያየት" "ቋንቋ: አማርኛ | ፆታ: ሴት | ዕድሜ: 46-55 | ትምህርት: ዲግሪ | መኖሪያ: ገንዴ ቆሬ" "1A365D"))
[void]$sb.AppendLine((Para-QA "ጥያቄ 7" "የኢኮኖሚ ማሻሻያ እርምጃዎች አቅጣጫ ምን ያህል ተስፋ ሰጪ ነው?" "ምርጫ: በከፊል ተስፋ ሰጪ ነው" "2B6CB0"))
[void]$sb.AppendLine((Para-QA "ጥያቄ 8" "የመንግስት የኑሮ ውድነትን የመቆጣጠር ስራ እና ድጎማዎችን ግምገማ (1-5)" "ደረጃ: 3 / 5 (መካከለኛ)" "2B6CB0"))
[void]$sb.AppendLine((Para-QA "ጥያቄ 9" "ፓርላማው የመንግስት አካላትን በግልጽነትና በተጠያቂነት የመቆጣጠር ሚና" "ምርጫ: መካከለኛ" "2B6CB0"))
[void]$sb.AppendLine((Para-QA "ጥያቄ 10" "ለቀጣይ የፖሊሲ ማሻሻያዎች ለመንግስት የሚያስተላልፉት ዋና ጥቆማ ወይም አስተያየት" "የዋጋ ግሽበቱን ለመቀነስ የሸቀጦች ቀጥተኛ አቅርቦት ዋስትና ሊሰጥ ይገባል። ፓርላማው ኦዲት ተቋሙን አጠናክሮ ቀጣይነት ያለው ጠንካራ ተጠያቂነት ማስፈን አለበት።" "2B6CB0"))

# Participant 5
[void]$sb.AppendLine((Para-CardHeader "Hirmaataa 05 — Qorannoo 2: Raawwii Paarlaamaa fi Dinagdee" "Afaan: Afaan Oromoo | Saala: Dhiira (ወንድ) | Umrii: 26-35 | Barnoota: Sadarkaa 2ffaa | Bakka: Bulee" "276749"))
[void]$sb.AppendLine((Para-QA "Gaaffii 7" "Kallattiin fooyya'iinsa dinagdee hammam abdachiisaadha?" "Filannoo: ተስፋ አስቆራጭ ነው / Abdii kan hin qabne" "276749"))
[void]$sb.AppendLine((Para-QA "Gaaffii 8" "Hojii qaala'iinsa jireenyaa to'achuu mootummaa (1-5)" "Sadarkaa: 2 / 5 (Gadi aanaa)" "276749"))
[void]$sb.AppendLine((Para-QA "Gaaffii 9" "Gahee paarlaamaan iftoominaa fi itti gaafatamummaa to'achuu keessatti qabu" "Filannoo: ዝቅተኛ / Gadi aanaa" "276749"))
[void]$sb.AppendLine((Para-QA "Gaaffii 10" "Yaadaa fi gorsa dabalataa" "Gatiin jireenyaa baay'ee ol ka'eera. Mootummaan suuqa to'annoo jala oolchuu qaba. Galii lammiilee fi baasii jiruu wajjin wal gituu barbaachisa. Mindaan hojjetaa xiqqaa ta'uu dhabe." "276749"))

# Participant 6
[void]$sb.AppendLine((Para-CardHeader "Hirmaattuu 06 — Qorannoo 3: Bu'uura Misoomaa fi Geejjiba Hawaasaa" "Afaan: Afaan Oromoo | Saala: Dubara (ሴት) | Umrii: 18-25 | Barnoota: Diblooma | Bakka: Legehaaree" "276749"))
[void]$sb.AppendLine((Para-QA "Gaaffii 11" "Geejjibni hawaasaa naannoo keessan jiru akkamitti argitu?" "Filannoo: ችግር አለበት / Rakkoo qaba" "276749"))
[void]$sb.AppendLine((Para-QA "Gaaffii 12" "Sadarkaa dhiyeessii bishaanii fi elektirikii (1-5)" "Sadarkaa: 2 / 5" "276749"))
[void]$sb.AppendLine((Para-QA "Gaaffii 13" "Turtii ijaarsa bu'uuraalee misoomaa furuuf maaltu ta'uu qaba?" "Geejjibni hawaasaa daandii baadiyyaa irratti baay'ee rakkisaadha. Konkolaataa dabalataa bituu fi daandii fooyyessuu barbaachisa. Bishaan dhugaatii guyyaa guyyaan dhabuun maatii rakkisa jira." "276749"))

# Participant 7
[void]$sb.AppendLine((Para-CardHeader "ተሳታፊ 07 — ሰርቪ 3: የከተማ መሠረተ ልማት እና የሕዝብ ትራንስፖርት አገልግሎት" "ቋንቋ: አማርኛ | ፆታ: ወንድ | ዕድሜ: 36-45 | ትምህርት: ዲግሪ | መኖሪያ: ድሬ ዳዋ ማዕከል" "1A365D"))
[void]$sb.AppendLine((Para-QA "ጥያቄ 11" "በአካባቢዎ ያለው የህዝብ ትራንስፖርት ተደራሽነትና ምቾት" "ምርጫ: አጥጋቢ (Satisfactory)" "2B6CB0"))
[void]$sb.AppendLine((Para-QA "ጥያቄ 12" "የውኃና የኤሌክትሪክ አቅርቦት ዘላቂነት ደረጃ (1-5)" "ደረጃ: 3 / 5 (መካከለኛ)" "2B6CB0"))
[void]$sb.AppendLine((Para-QA "ጥያቄ 13" "በመሠረተ ልማት ዝርጋታ ወቅት የሚታዩ መዘግየቶችን ለመቅረፍ መፍትሄ" "የኤሌክትሪክ አቅርቦት ያልተቋጠረ መቆራረጥ ለቤት ኢኮኖሚ ትልቅ ጫና ፈጥሯል። የውኃ አቅርቦትም ዘላቂ አይደለም። ቴክኒካዊ ቡድን ወቅቱን ጠብቆ ጥገናዎቹን ቢሰራ ችግሩ ይቀንሳል።" "2B6CB0"))

# Participant 8
[void]$sb.AppendLine((Para-CardHeader "Ka-qaybgale 08 — Xog-ururin 4: Dib-u-habeynta Waxbarashada iyo Caafimaadka" "Luqadda: Af-Soomaali | Lab/Dhedig: Dhedig (ሴት) | Da'da: 26-35 | Waxbarasho: Master | Goobta: Addis Qadana" "C53030"))
[void]$sb.AppendLine((Para-QA "Su'aasha 14" "Heerka daawooyinka iyo qalabka caafimaadka ee isbitaalada dowladda (1-5)" "Heerka: 2 / 5 (Hooseeya / Gadi aanaa)" "C53030"))
[void]$sb.AppendLine((Para-QA "Su'aasha 15" "Ma taageersan tahay tallaabooyinka tayada waxbarashada?" "Filasho: በከፊል እደግፋለሁ / Qayb ahaan waan taageersanahay" "C53030"))

# Participant 9
[void]$sb.AppendLine((Para-CardHeader "Hirmaataa 09 — Qorannoo 5: Magaalaa Ispoortii fi Sirna Dijitaalaa" "Afaan: Afaan Oromoo | Saala: Dhiira (ወንድ) | Umrii: 18-25 | Barnoota: Diblooma | Bakka: Melka Jebdu" "276749"))
[void]$sb.AppendLine((Para-QA "Gaaffii 16" "Mijattina tajaajila sarara toora interneetii Dirree Dawaa (1-5)" "Sadarkaa: 4 / 5 (Olaanaa / Baay'ee Gaarii)" "276749"))
[void]$sb.AppendLine((Para-QA "Gaaffii 17" "Odeeffannoon mootummaa Telegiraamaa fi miidiyaa hawaasaatiin qaqqabuu" "Filannoo: ከፍተኛ / Olaanaa" "276749"))

# Participant 10
[void]$sb.AppendLine((Para-CardHeader "ተሳታፊ 10 — ሰርቪ 5: የድሬዳዋ ስማርት ሲቲ እና ዲጂታል አሰራር የሕዝብ እርካታ" "ቋንቋ: አማርኛ | ፆታ: ሴት | ዕድሜ: 46-55 | ትምህርት: ዲግሪ | መኖሪያ: ገንዴ ቆሬ" "1A365D"))
[void]$sb.AppendLine((Para-QA "ጥያቄ 16" "የኦንላይን እና ዲጂታል አገልግሎቶች አሰጣጥ ምቾት ደረጃ (1-5)" "ደረጃ: 3 / 5 (መካከለኛ)" "2B6CB0"))
[void]$sb.AppendLine((Para-QA "ጥያቄ 17" "የመንግስት መረጃዎች እና ውሳኔዎች በቴሌግራም ተዳራሽ የመሆናቸው ደረጃ" "ምርጫ: መካከለኛ (Medium)" "2B6CB0"))

# Footer note
[void]$sb.AppendLine("<w:p><w:pPr><w:jc w:val=""center""/><w:spacing w:before=""240""/><w:pBdr><w:top w:val=""single"" w:sz=""6"" w:space=""6"" w:color=""CBD5E0""/></w:pBdr></w:pPr><w:r><w:rPr><w:rFonts w:ascii=""Segoe UI"" w:hAnsi=""Segoe UI"" w:cs=""Nyala""/><w:sz w:val=""18""/><w:szCs w:val=""18""/><w:color w:val=""718096""/></w:rPr><w:t xml:space=""preserve"">ሰነዱ የተዘጋጀው በድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ የዳሰሳ ጥናት ዳታቤዝ ሲስተም ነው :: © 2026 DGC Survey Platform</w:t></w:r></w:p>")

# Page setup A4 portrait
[void]$sb.AppendLine(@"
  <w:sectPr>
    <w:pgSz w:w="11906" w:h="16838"/>
    <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/>
  </w:sectPr>
"@)

[void]$sb.AppendLine('</w:body></w:document>')

[System.IO.File]::WriteAllText((Join-Path $buildDir "word\document.xml"), $sb.ToString(), $utf8NoBom)

# Zip using .NET System.IO.Compression.ZipFile
Add-Type -AssemblyName System.IO.Compression.FileSystem
$tempZip = Join-Path $env:TEMP ("docx_out_" + [Guid]::NewGuid().ToString("N") + ".zip")
[System.IO.Compression.ZipFile]::CreateFromDirectory($buildDir, $tempZip)

if (Test-Path $targetDocx) { Remove-Item $targetDocx -Force }
Move-Item $tempZip $targetDocx -Force

# Also remove old .doc if exists or regenerate properly
if (Test-Path $targetDoc) { Remove-Item $targetDoc -Force }

Remove-Item -Recurse -Force $buildDir

Write-Output "SUCCESS_SIZE: $((Get-Item $targetDocx).Length)"
