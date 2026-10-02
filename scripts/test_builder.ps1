$ErrorActionPreference = "Stop"

$outFolder = Join-Path $env:TEMP "docx_test_build"
if (Test-Path $outFolder) { Remove-Item -Recurse -Force $outFolder }
$null = New-Item -ItemType Directory -Path (Join-Path $outFolder "_rels")
$null = New-Item -ItemType Directory -Path (Join-Path $outFolder "word\_rels")

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# [Content_Types].xml
$ctXml = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>
'@
[System.IO.File]::WriteAllText((Join-Path $outFolder "[Content_Types].xml"), $ctXml, $utf8NoBom)

# _rels/.rels
$relsXml = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
'@
[System.IO.File]::WriteAllText((Join-Path $outFolder "_rels\.rels"), $relsXml, $utf8NoBom)

# word/_rels/document.xml.rels
$docRelsXml = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
'@
[System.IO.File]::WriteAllText((Join-Path $outFolder "word\_rels\document.xml.rels"), $docRelsXml, $utf8NoBom)

# word/styles.xml
$stylesXml = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Segoe UI" w:hAnsi="Segoe UI" w:cs="Nyala"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
        <w:color w:val="2D3748"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
</w:styles>
'@
[System.IO.File]::WriteAllText((Join-Path $outFolder "word\styles.xml"), $stylesXml, $utf8NoBom)

# word/document.xml
$docXml = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="200"/></w:pPr>
      <w:r>
        <w:rPr><w:b/><w:sz w:val="32"/><w:szCs w:val="32"/><w:color w:val="1A365D"/></w:rPr>
        <w:t>የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr><w:spacing w:after="140"/></w:pPr>
      <w:r>
        <w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/><w:color w:val="2D3748"/></w:rPr>
        <w:t>ሰላም! ይህ የአማርኛ ጽሑፍ ትክክለኛ የ Word ዶክመንት ማረጋገጫ ነው።</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>
'@
[System.IO.File]::WriteAllText((Join-Path $outFolder "word\document.xml"), $docXml, $utf8NoBom)

$testZip = "c:\Users\acer\Downloads\dgcweb--main\test_sample.docx"
if (Test-Path $testZip) { Remove-Item $testZip -Force }

$ProgressPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$tempZipFile = Join-Path $env:TEMP ("docx_zip_" + [Guid]::NewGuid().ToString("N") + ".zip")
[System.IO.Compression.ZipFile]::CreateFromDirectory($outFolder, $tempZipFile)
Move-Item $tempZipFile $testZip -Force
Remove-Item -Recurse -Force $outFolder
Write-Output "DONE_SIZE: $((Get-Item $testZip).Length)"
