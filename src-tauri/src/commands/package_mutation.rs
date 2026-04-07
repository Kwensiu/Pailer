use crate::commands::powershell::CommandResult;
use crate::models::ScoopPackage;
use serde::Serialize;

pub const EVENT_PACKAGE_MUTATION_FINISHED: &str = "package-mutation-finished";

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PackageMutationFinishedEvent {
    #[serde(flatten)]
    pub result: CommandResult,
    pub package_name: String,
    pub package_source: Option<String>,
    pub package_state: Option<ScoopPackage>,
}
