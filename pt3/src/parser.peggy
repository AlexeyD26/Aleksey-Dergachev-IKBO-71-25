Document
  = Gap declarations:Declaration* { return declarations; }

Declaration
  = "var" Space+ name:Name Gap ":=" Gap value:Value Gap ";" Gap {
      return { name, value };
    }

Value
  = List / Text / Decimal / Reference

List
  = "list" Gap "(" Gap items:Items? ")" { return items ?? []; }

Items
  = first:Value rest:(Gap "," Gap item:Value { return item; })* Gap {
      return [first, ...rest];
    }

Text
  = "[[" content:$(!"]]" .)* "]]" { return content; }

Decimal
  = digits:$([+-]? [0-9]+ "." [0-9]+) { return Number(digits); }

Reference
  = "${" name:Name "}" { return { reference: name }; }

Name
  = $[a-z]+

Gap
  = Space*

Space
  = [ \t\r\n] / LineComment / BlockComment

LineComment
  = "*" [^\r\n]*

BlockComment
  = "=begin" (!"=cut" .)* "=cut"
