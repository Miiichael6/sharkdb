//! Comandos del shell que no son JavaScript (`use otra`, `show dbs`): si una línea empieza por
//! uno de ellos, esa sentencia se reescribe, en la misma línea, como llamada a `__shell`. Así las
//! posiciones de los errores siguen coincidiendo con el script original.

const USE: &str = "use";
const SHOW: &str = "show";

pub fn rewrite(code: &str) -> String {
    code.split('\n')
        .map(|line| rewrite_line(line).unwrap_or_else(|| line.to_string()))
        .collect::<Vec<_>>()
        .join("\n")
}

fn rewrite_line(line: &str) -> Option<String> {
    let (indent, body) = line.split_at(line.len() - line.trim_start().len());
    let (statement, rest) = body.split_once(';').unwrap_or((body, ""));
    let (command, argument) = statement.trim_end().split_once(char::is_whitespace)?;
    let argument = argument.trim();
    let hook = match command {
        USE => "use",
        SHOW => "show",
        _ => return None,
    };
    if argument.is_empty() || !argument.chars().all(is_name_char) {
        return None;
    }
    Some(format!("{indent}__shell.{hook}(\"{argument}\");{rest}"))
}

/// Caracteres válidos en un nombre de base de datos o en el argumento de `show`.
fn is_name_char(c: char) -> bool {
    c.is_alphanumeric() || matches!(c, '_' | '-')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rewrites_use_and_show_lines_in_place() {
        assert_eq!(
            rewrite("use otra;\n  show dbs\nshow collections ;"),
            "__shell.use(\"otra\");\n  __shell.show(\"dbs\");\n__shell.show(\"collections\");"
        );
    }

    #[test]
    fn keeps_the_rest_of_the_line() {
        assert_eq!(
            rewrite("use otra; db.y.count()"),
            "__shell.use(\"otra\"); db.y.count()"
        );
    }

    #[test]
    fn leaves_javascript_untouched() {
        let code = "var use = 1;\nshow = use + 1;\nprint('use otra')\nuse(x)\nuse a b";
        assert_eq!(rewrite(code), code);
    }

    #[test]
    fn keeps_line_count() {
        let code = "var a = 1;\r\nuse test\r\nnoExiste();";
        assert_eq!(rewrite(code).lines().count(), code.lines().count());
        assert!(rewrite(code).contains("__shell.use(\"test\");"));
    }
}
