Задание 1.
cut -d: -f1 /etc/passwd | sort

Задание 2.
awk '{print $2, $1}' /etc/protocols | sort -nr | head -n 5

Задание 3.
s="$1"; l=$((${#s}+2)); b="+"$(printf '%*s' "$l" | tr ' ' '-')"+"; echo "$b"; echo "| $s |"; echo "$b"

Задание 4.
grep -oE '\b[a-zA-Z_][a-zA-Z0-9_]*\b' "$1" | sort -u

Задание 5.
chmod +x "$1" && sudo cp "$1" /usr/local/bin/

Задание 6.
head -n 1 "$1" | grep -E '^\s*(//|/\*)'

Задание 7.
find "${1:-.}" -type f -exec md5sum {} + | sort | uniq -w32 -dD

Задание 8.
find . -maxdepth 1 -name "*.$1" | tar -czf archive.tar.gz -T -

Задание 9.
sed 's/\t/    /g' "$1"

Задание 10.
find "${1:-.}" -type f -empty
