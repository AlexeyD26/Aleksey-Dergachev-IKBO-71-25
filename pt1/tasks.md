# Практическое задание 1

### Задание 1
```bash
cut -d: -f1 /etc/passwd | sort
```

### Задание 2
```bash
awk '{print $2, $1}' /etc/protocols | sort -nr | head -n 5
```

### Задание 3
```bash
text="$*"
len=${#text}

border="+"
for ((i=0; i<len+2; i++)); do
    border="${border}-"
done
border="${border}+"

echo "$border"
echo "| $text |"
echo "$border"
```

### Задание 4
```bash
file="$1"
keywords="auto|break|case|char|const|continue|default|do|double|else|enum|extern|float|for|goto|if|int|long|register|return|short|signed|sizeof|static|struct|switch|typedef|union|unsigned|void|volatile|while"

grep -oE '\b[a-zA-Z_][a-zA-Z0-9_]*\b' "$file" | grep -Ev "^($keywords)$" | sort -u
```

### Задание 5
```bash
file="$1"

if [ -f "$file" ]; then
    chmod +x "$file"
    sudo cp "$file" /usr/local/bin/
    echo "Команда $file зарегистрирована"
else
    echo "Файл не найден"
    exit 1
fi
```

### Задание 6
```bash
file="$1"

if head -n 1 "$file" | grep -qE '^\s*(//|/\*)'; then
    echo "Файл начинается с комментария"
else
    echo "Комментарий в начале не найден"
fi
```

### Задание 7
```bash
dir="${1:-.}"

find "$dir" -type f -exec md5sum {} + | sort | uniq -w32 -dD
```

### Задание 8
```bash
ext="$1"

find . -maxdepth 1 -type f -name "*.$ext" | tar -czf archive.tar.gz -T -
```

### Задание 9
```bash
sed 's/\t/    /g' "$1"
```

### Задание 10
```bash
find "${1:-.}" -type f -empty
```
