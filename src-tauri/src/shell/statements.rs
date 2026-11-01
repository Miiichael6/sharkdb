//! Parte un script en sus sentencias de primer nivel para ejecutarlas una a una, como Robo 3T:
//! así cada sentencia que devuelve algo deja su propio resultado. Va después de
//! `syntax::rewrite`, que ya convirtió `use x` / `show dbs` en JavaScript.

use oxc_allocator::Allocator;
use oxc_ast::ast::Statement as Node;
use oxc_parser::Parser;
use oxc_span::{GetSpan, SourceType, Span};

/// Una sentencia de primer nivel y dónde empieza en el script.
#[derive(Debug, Clone, PartialEq)]
pub struct Statement<'a> {
    pub code: &'a str,
    /// Línea donde empieza, desde 1.
    pub line: u32,
    /// Caracteres de esa línea que hay antes de la sentencia.
    pub column: usize,
    /// Una expresión (`db.x.find()`, `1 + 1`): su valor siempre se muestra.
    pub is_expression: bool,
    /// Una declaración de función: se evalúa antes que el resto para respetar el hoisting.
    pub is_hoisted: bool,
}

impl Statement<'_> {
    /// La sentencia con saltos de línea y espacios delante, para que los errores de QuickJS
    /// citen la línea y la columna del script original.
    pub fn padded(&self) -> String {
        let indent = "\n".repeat(self.line as usize - 1) + &" ".repeat(self.column);
        indent + self.code
    }
}

/// Las sentencias del script en orden. Si no se puede analizar (un error de sintaxis), el script
/// entero es una sola sentencia y QuickJS dará el error con su posición.
pub fn split(code: &str) -> Vec<Statement<'_>> {
    let allocator = Allocator::default();
    let parsed = Parser::new(&allocator, code, SourceType::script()).parse();
    if parsed.fatal_error || parsed.diagnostics.has_errors() {
        return whole_script(code);
    }
    let program = &parsed.program;
    // Un string suelto al principio (`"hola"`) es una directiva, como `"use strict"`: el parser no
    // lo pone en `body`, pero en el shell es una expresión más y su valor se muestra.
    let directives = program
        .directives
        .iter()
        .map(|directive| statement_at(code, directive.span, true, false));
    let body = program.body.iter().map(|node| {
        let is_expression = matches!(node, Node::ExpressionStatement(_));
        let is_hoisted = matches!(node, Node::FunctionDeclaration(_));
        statement_at(code, node.span(), is_expression, is_hoisted)
    });
    directives.chain(body).collect()
}

fn statement_at(code: &str, span: Span, is_expression: bool, is_hoisted: bool) -> Statement<'_> {
    let start = span.start as usize;
    let (line, column) = position(code, start);
    Statement {
        code: &code[start..span.end as usize],
        line,
        column,
        is_expression,
        is_hoisted,
    }
}

fn whole_script(code: &str) -> Vec<Statement<'_>> {
    if code.trim().is_empty() {
        return Vec::new();
    }
    vec![Statement {
        code,
        line: 1,
        column: 0,
        is_expression: false,
        is_hoisted: false,
    }]
}

/// Línea (desde 1) y caracteres previos en esa línea del byte `offset`.
fn position(code: &str, offset: usize) -> (u32, usize) {
    let before = &code[..offset];
    let line = before.matches('\n').count() as u32 + 1;
    let line_start = before.rfind('\n').map_or(0, |i| i + 1);
    (line, before[line_start..].chars().count())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_top_level_statements_with_their_position() {
        let code = "const x = 1;\nfor (let i = 0; i < 2; i++) { print(i); }\n  db.a.find({}); x";
        let statements = split(code);
        let summary: Vec<_> = statements
            .iter()
            .map(|s| (s.code, s.line, s.column, s.is_expression))
            .collect();
        assert_eq!(
            summary,
            [
                ("const x = 1;", 1, 0, false),
                ("for (let i = 0; i < 2; i++) { print(i); }", 2, 0, false),
                ("db.a.find({});", 3, 2, true),
                ("x", 3, 17, true),
            ]
        );
    }

    #[test]
    fn marks_function_declarations_as_hoisted() {
        let statements = split("print(f());\nfunction f() { return 1; }");
        assert_eq!(
            statements.iter().map(|s| s.is_hoisted).collect::<Vec<_>>(),
            [false, true]
        );
    }

    #[test]
    fn syntax_error_keeps_the_whole_script() {
        let code = "var a = 1;\nvar b = ;";
        assert_eq!(split(code), whole_script(code));
        assert!(split("  \n// nada\n").is_empty());
    }

    #[test]
    fn padding_keeps_line_and_column() {
        let statement = &split("a();\r\n  b()")[1];
        assert_eq!(statement.padded(), "\n  b()");
    }

    #[test]
    fn a_leading_string_is_an_expression() {
        let statements = split("\"hola\"
db.a.find()");
        let summary: Vec<_> = statements.iter().map(|s| (s.code, s.line, s.is_expression)).collect();
        assert_eq!(summary, [("\"hola\"", 1, true), ("db.a.find()", 2, true)]);
    }

    #[test]
    fn use_strict_before_code_keeps_the_rest() {
        let statements = split("'use strict';
var a = 1;
a");
        let codes: Vec<_> = statements.iter().map(|s| s.code).collect();
        assert_eq!(codes, ["'use strict';", "var a = 1;", "a"]);
        assert_eq!(statements[2].line, 3);
    }

    #[test]
    fn columns_count_characters_not_bytes() {
        let statements = split("print('ñ'); x");
        assert_eq!(statements[1].column, 12);
    }
}
